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
  // WordPress Application Passwords are displayed with spaces but must be sent without them
  const cleanPassword = appPassword.replace(/\s+/g, '');
  const token = Buffer.from(`${username}:${cleanPassword}`).toString('base64');

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
  // Strip spaces from app password — WordPress accepts both forms
  const cleanPassword = appPassword.replace(/\s+/g, '');

  try {
    const client = createWPClient(wpUrl, username, cleanPassword);
    await client.get('/users/me');
    const siteRes = await axios.get(`${wpUrl}/wp-json`, { timeout: 15000 });
    return {
      success: true,
      siteTitle: siteRes.data?.name || 'WordPress Site',
    };
  } catch (err: unknown) {
    const error = err as {
      response?: { status?: number };
      code?: string;
      message?: string;
    };
    const status = error?.response?.status;

    if (status === 401) {
      return {
        success: false,
        error:
          'Invalid credentials (401). Make sure you are using an Application Password, not your login password. Generate one at: WP Admin → Users → Profile → Application Passwords.',
      };
    }
    if (status === 403) {
      return {
        success: false,
        error:
          'Access denied (403). Application Passwords may be disabled or blocked by a security plugin (e.g. Wordfence). Check your WordPress security settings.',
      };
    }
    if (status === 404) {
      return {
        success: false,
        error:
          'WordPress REST API not found (404). Verify the site URL is correct and the REST API is enabled.',
      };
    }
    if (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND') {
      return {
        success: false,
        error: `Cannot reach the site: ${error.message}. Verify the WordPress URL is correct and the site is online.`,
      };
    }
    if (error?.code === 'ECONNABORTED') {
      return {
        success: false,
        error: 'Connection timed out. The site took too long to respond.',
      };
    }
    return {
      success: false,
      error: `Could not connect to WordPress${status ? ` (HTTP ${status})` : ''}. Verify the URL and credentials.`,
    };
  }
}

export async function getPostByUrl(
  wpUrl: string,
  username: string,
  appPassword: string,
  pageUrl: string
): Promise<WPPost | null> {
  // Use unauthenticated requests for public slug lookup — avoids 403 from
  // security plugins (e.g. Wordfence) that block authenticated REST endpoints
  const baseURL = wpUrl.endsWith('/') ? `${wpUrl}wp-json/wp/v2` : `${wpUrl}/wp-json/wp/v2`;

  // Extract slug from URL
  const slug = new URL(pageUrl).pathname.split('/').filter(Boolean).pop() || '';

  // Try posts first (public endpoint — no auth needed)
  try {
    const postsRes = await axios.get(`${baseURL}/posts`, {
      params: { slug, _embed: false },
      timeout: 30000,
    });
    if (postsRes.data?.length > 0) return postsRes.data[0];
  } catch { /* continue */ }

  // Try pages (public endpoint — no auth needed)
  try {
    const pagesRes = await axios.get(`${baseURL}/pages`, {
      params: { slug, _embed: false },
      timeout: 30000,
    });
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
