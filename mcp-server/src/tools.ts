import { callWordPressAPI } from './wordpress-api.js';

interface Tool {
  description: string;
  inputSchema: Record<string, any>;
  handler: (args: any, token: string) => Promise<any>;
}

export const readerTools: Record<string, Tool> = {
  getReaderMenu: {
    description: 'Get default reader menu',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (args, token) => {
      return callWordPressAPI('/read/menu', token);
    },
  },

  getFeed: {
    description: 'Get details about a feed',
    inputSchema: {
      type: 'object',
      properties: {
        feed_url_or_id: {
          type: 'string',
          description: 'Feed URL or ID',
        },
      },
      required: ['feed_url_or_id'],
    },
    handler: async (args, token) => {
      return callWordPressAPI(`/read/feed/${encodeURIComponent(args.feed_url_or_id)}`, token);
    },
  },

  getPost: {
    description: 'Get a single post by ID',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site domain or ID',
        },
        post_id: {
          type: 'string',
          description: 'Post ID',
        },
      },
      required: ['site', 'post_id'],
    },
    handler: async (args, token) => {
      return callWordPressAPI(`/read/sites/${args.site}/posts/${args.post_id}`, token);
    },
  },

  getFollowingPosts: {
    description: 'Get a list of posts from the blogs a user follows',
    inputSchema: {
      type: 'object',
      properties: {
        number: {
          type: 'number',
          description: 'Number of posts to return (default: 20)',
        },
        page: {
          type: 'number',
          description: 'Page number',
        },
      },
    },
    handler: async (args, token) => {
      const params = new URLSearchParams();
      if (args.number) params.append('number', args.number.toString());
      if (args.page) params.append('page', args.page.toString());
      
      return callWordPressAPI(`/read/following?${params}`, token);
    },
  },

  getLikedPosts: {
    description: 'Get a list of posts from the blogs a user likes',
    inputSchema: {
      type: 'object',
      properties: {
        number: {
          type: 'number',
          description: 'Number of posts to return',
        },
      },
    },
    handler: async (args, token) => {
      const params = new URLSearchParams();
      if (args.number) params.append('number', args.number.toString());
      
      return callWordPressAPI(`/read/liked?${params}`, token);
    },
  },

  getTagPosts: {
    description: 'Get a list of posts from a tag',
    inputSchema: {
      type: 'object',
      properties: {
        tag: {
          type: 'string',
          description: 'Tag name',
        },
        number: {
          type: 'number',
          description: 'Number of posts to return',
        },
      },
      required: ['tag'],
    },
    handler: async (args, token) => {
      const params = new URLSearchParams();
      if (args.number) params.append('number', args.number.toString());
      
      return callWordPressAPI(`/read/tags/${encodeURIComponent(args.tag)}/posts?${params}`, token);
    },
  },

  getUserTags: {
    description: 'Get a list of tags subscribed to by the user',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (args, token) => {
      return callWordPressAPI('/read/tags', token);
    },
  },

  subscribeToTag: {
    description: 'Subscribe to a new tag',
    inputSchema: {
      type: 'object',
      properties: {
        tag: {
          type: 'string',
          description: 'Tag name to subscribe to',
        },
      },
      required: ['tag'],
    },
    handler: async (args, token) => {
      return callWordPressAPI(
        `/read/tags/${encodeURIComponent(args.tag)}/mine/new`,
        token,
        'POST'
      );
    },
  },

  unsubscribeFromTag: {
    description: 'Unsubscribe from a tag',
    inputSchema: {
      type: 'object',
      properties: {
        tag: {
          type: 'string',
          description: 'Tag name to unsubscribe from',
        },
      },
      required: ['tag'],
    },
    handler: async (args, token) => {
      return callWordPressAPI(
        `/read/tags/${encodeURIComponent(args.tag)}/mine/delete`,
        token,
        'POST'
      );
    },
  },

  getFollowingFeeds: {
    description: 'Get a list of the feeds the user is following',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (args, token) => {
      return callWordPressAPI('/read/following/mine', token);
    },
  },

  followBlog: {
    description: 'Follow the specified blog',
    inputSchema: {
      type: 'object',
      properties: {
        site_url: {
          type: 'string',
          description: 'Blog URL to follow',
        },
      },
      required: ['site_url'],
    },
    handler: async (args, token) => {
      return callWordPressAPI('/read/following/mine/new', token, 'POST', {
        url: args.site_url,
      });
    },
  },

  unfollowBlog: {
    description: 'Unfollow the specified blog',
    inputSchema: {
      type: 'object',
      properties: {
        site_url: {
          type: 'string',
          description: 'Blog URL to unfollow',
        },
      },
      required: ['site_url'],
    },
    handler: async (args, token) => {
      return callWordPressAPI('/read/following/mine/delete', token, 'POST', {
        url: args.site_url,
      });
    },
  },

  getRecommendations: {
    description: 'Get a list of blog recommendations for the current user',
    inputSchema: {
      type: 'object',
      properties: {
        number: {
          type: 'number',
          description: 'Number of recommendations to return',
        },
      },
    },
    handler: async (args, token) => {
      const params = new URLSearchParams();
      if (args.number) params.append('number', args.number.toString());
      
      return callWordPressAPI(`/read/recommendations/mine?${params}`, token);
    },
  },
};