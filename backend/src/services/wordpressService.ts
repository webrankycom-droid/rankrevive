import axios, { AxiosInstance } from 'axios';
import { queryOne } from '../db';

export interface WPPost {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  status: string;
  link: string;
  modified: string;
  slug: string;
  excerpt: { rendered: string };
}

export interface WPUpdatePayload {
  title?: string;
  content?: string;
  status?: 'publish' | 'draft' | 'pending';
  excerpt?: string;
  meta?: Record<string, string>;
}

export interface WPPage {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  link: string;
  status: string;
}

function createWPClient(wpUrl: string, username: string, appPassword: string): AxiosInstance {
  const baseURL = wpUrl.endsWith('/') ? `${wpUrl}wp-json/wp/v2` : `${wpUrl}/wp-json/wp/v2`;
  const token = Buffer.from(`${username}:${appPassword}`).toString('base64');

  return axios.create({
    baseURL,
    headers: {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });
}

export async function testConnection(
  wpUrl: string,
  username: string,
  appPassword: string
): Promise<{ success: boolean; siteTitle?: string; error?: string }> {
  try {
    const client = createWPClient(wpUrl, username, appPassword);
    const response = await client.get('/users/me');
    const siteRes = await axios.get(`${wpUrl}/wp-json`);
    return {
      success: true,
      siteTitle: siteRes.data?.name || 'WordPress Site',
    };
  } catch (err: unknown) {
    const error = err as { response?: { status?: number } };
    return {
      success: false,
      error: error?.response?.status === 401
        ? 'Invalid credentials. Check your username and app password.'
        : 'Could not connect to WordPress. Verify the URL and credentials.',
    };
  }
}

export async function getPostByUrl(
  wpUrl: string,
  username: string,
  appPassword: string,
  pageUrl: string
): Promise<WPPost | null> {
  const client = createWPClient(wpUrl, username, appPassword);

  // Extract slug from URL
  const urlPath = new URL(pageUrl).pathname;
  const slug = urlPath.replace(/^\/|\/$/g, '').split('/').pop() || '';

  // Try posts first
  try {
    const postsRes = await client.get('/posts', { params: { slug, _embed: false } });
    if (postsRes.data?.length > 0) return postsRes.data[0];
  } catch { /* continue */ }

  // Try pages
  try {
    const pagesRes = await client.get('/pages', { params: { slug, _embed: false } });
    if (pagesRes.data?.length > 0) return pagesRes.data[0];
  } catch { /* continue */ }

  return null;
}

export async function fetchPostContent(
  wpUrl: string,
  username: string,
  appPassword: string,
  postId: number,
  postType: 'posts' | 'pages' = 'posts'
): Promise<string> {
  const client = createWPClient(wpUrl, username, appPassword);
  const response = await client.get(`/${postType}/${postId}`);
  return response.data.content?.rendered || '';
}

export async function updatePost(
  wpUrl: string,
  username: string,
  appPassword: string,
  postId: number,
  payload: WPUpdatePayload,
  postType: 'posts' | 'pages' = 'posts'
): Promise<{ success: boolean; postId: number; link?: string }> {
  const client = createWPClient(wpUrl, username, appPassword);

  const updateData: Record<string, unknown> = {};
  if (payload.title) updateData.title = payload.title;
  if (payload.content) updateData.content = payload.content;
  if (payload.status) updateData.status = payload.status;
  if (payload.excerpt) updateData.excerpt = payload.excerpt;

  const response = await client.post(`/${postType}/${postId}`, updateData);
  return {
    success: true,
    postId: response.data.id,
    link: response.data.link,
  };
}

export async function createPost(
  wpUrl: string,
  username: string,
  appPassword: string,
  payload: WPUpdatePayload & { title: string; content: string }
): Promise<{ success: boolean; postId: number; link?: string }> {
  const client = createWPClient(wpUrl, username, appPassword);
  const response = await client.post('/posts', payload);
  return {
    success: true,
    postId: response.data.id,
    link: response.data.link,
  };
}

export async function publishOptimizationToWordPress(
  siteId: string,
  pageId: string,
  optimizedContent: string,
  status: 'publish' | 'draft' = 'draft'
): Promise<{ success: boolean; wpPostId?: number; link?: string; error?: string }> {
  const site = await queryOne<{
    wp_url: string;
    wp_username: string;
    wp_app_password: string;
  }>('SELECT wp_url, wp_username, wp_app_password FROM sites WHERE id = $1', [siteId]);

  if (!site || !site.wp_url) {
    throw new Error('WordPress not configured for this site');
  }

  const page = await queryOne<{ url: string; title: string }>(
    'SELECT url, title FROM pages WHERE id = $1',
    [pageId]
  );

  if (!page) throw new Error('Page not found');

  try {
    const existingPost = await getPostByUrl(
      site.wp_url,
      site.wp_username,
      site.wp_app_password,
      page.url
    );

    if (existingPost) {
      const postType = existingPost.link?.includes('/page/') ? 'pages' : 'posts';
      const result = await updatePost(
        site.wp_url,
        site.wp_username,
        site.wp_app_password,
        existingPost.id,
        { content: optimizedContent, status },
        postType
      );
      return { ...result, wpPostId: result.postId };
    } else {
      const result = await createPost(
        site.wp_url,
        site.wp_username,
        site.wp_app_password,
        {
          title: page.title || page.url,
          content: optimizedContent,
          status,
        }
      );
      return { ...result, wpPostId: result.postId };
    }
  } catch (err: unknown) {
    const error = err as Error;
    return { success: false, error: error.message };
  }
}

export async function listRecentPosts(
  wpUrl: string,
  username: string,
  appPassword: string,
  limit = 20
): Promise<WPPost[]> {
  const client = createWPClient(wpUrl, username, appPassword);
  const response = await client.get('/posts', {
    params: { per_page: limit, orderby: 'modified', order: 'desc' },
  });
  return response.data || [];
}

export const wordpressService = {
  testConnection,
  getPostByUrl,
  fetchPostContent,
  updatePost,
  createPost,
  publishOptimizationToWordPress,
  listRecentPosts,
};
