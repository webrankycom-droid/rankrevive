export const PLANS = {
  starter: {
    name: 'Starter',
    price: 29,
    pagesPerMonth: 10,
    features: ['10 pages/month', 'GSC integration', 'Claude AI optimization', 'Basic analytics'],
  },
  pro: {
    name: 'Pro',
    price: 79,
    pagesPerMonth: 100,
    features: ['100 pages/month', 'GSC integration', 'Claude + GPT-4', 'Advanced analytics', 'WP auto-publish'],
  },
  agency: {
    name: 'Agency',
    price: 249,
    pagesPerMonth: 500,
    features: ['500 pages/month', 'Multiple sites', 'Priority AI', 'White-label reports', 'API access'],
  },
} as const;
