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

  getA8CPosts: {
    description: 'Get Automattic company posts from the A8C stream',
    inputSchema: {
      type: 'object',
      properties: {
        number: {
          type: 'number',
          description: 'Number of posts to return (default: 4)',
        },
        orderBy: {
          type: 'string',
          description: 'Order posts by (default: date)',
          enum: ['date', 'popularity'],
        },
        content_width: {
          type: 'number',
          description: 'Content width in pixels (default: 675)',
        },
        lang: {
          type: 'string',
          description: 'Language code (default: en)',
        },
      },
    },
    handler: async (args, token) => {
      const params = new URLSearchParams({
        http_envelope: '1',
        orderBy: args.orderBy || 'date',
        meta: 'post,discover_original_post',
        feed_id: '',
        number: (args.number || 4).toString(),
        lang: args.lang || 'en',
        content_width: (args.content_width || 675).toString(),
      });
      
      return callWordPressAPI(`/rest/v1.2/read/a8c?${params}`, token);
    },
  },

  // Notifications API endpoints
  getNotifications: {
    description: 'Get a list of user notifications in reverse chronological order',
    inputSchema: {
      type: 'object',
      properties: {
        number: {
          type: 'number',
          description: 'Number of notifications to return (max 99, default 9)',
        },
        unread: {
          type: 'boolean',
          description: 'Return only unread notifications',
        },
        read: {
          type: 'boolean',
          description: 'Return only read notifications',
        },
        type: {
          type: 'string',
          description: 'Filter by notification type (e.g., comment, like, follow)',
        },
        since: {
          type: 'number',
          description: 'Return notifications since this UNIX timestamp',
        },
        before: {
          type: 'number',
          description: 'Return notifications before this UNIX timestamp',
        },
        fields: {
          type: 'string',
          description: 'Comma-separated list of specific fields to return',
        },
        ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of specific notification IDs to return',
        },
      },
    },
    handler: async (args, token) => {
      const params = new URLSearchParams();
      
      if (args.number) params.append('number', Math.min(args.number, 99).toString());
      if (args.unread !== undefined) params.append('unread', args.unread.toString());
      if (args.read !== undefined) params.append('read', args.read.toString());
      if (args.type) params.append('type', args.type);
      if (args.since) params.append('since', args.since.toString());
      if (args.before) params.append('before', args.before.toString());
      if (args.fields) params.append('fields', args.fields);
      if (args.ids && args.ids.length > 0) {
        args.ids.forEach((id: number) => params.append('ids[]', id.toString()));
      }
      
      return callWordPressAPI(`/notifications?${params}`, token);
    },
  },

  markNotificationsSeen: {
    description: 'Mark notifications as seen by setting the timestamp of the most recently seen notification',
    inputSchema: {
      type: 'object',
      properties: {
        time: {
          type: 'number',
          description: 'UNIX timestamp of the most recently seen notification',
        },
      },
      required: ['time'],
    },
    handler: async (args, token) => {
      return callWordPressAPI('/notifications/seen', token, 'POST', {
        time: args.time,
      });
    },
  },

  markNotificationsRead: {
    description: 'Mark a set of notifications as read',
    inputSchema: {
      type: 'object',
      properties: {
        counts: {
          type: 'object',
          description: 'Object with notification IDs as keys and counts as values (e.g., {"1621046109": 1})',
        },
        notifications: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of notification IDs to mark as read',
        },
      },
    },
    handler: async (args, token) => {
      let body: any = {};
      
      if (args.counts) {
        body.counts = args.counts;
      } else if (args.notifications && args.notifications.length > 0) {
        // Convert array of IDs to counts format
        body.counts = {};
        args.notifications.forEach((id: number) => {
          body.counts[id] = 1;
        });
      }
      
      return callWordPressAPI('/notifications/read', token, 'POST', body);
    },
  },

  getUnreadNotificationsCount: {
    description: 'Get count of unread notifications',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (args, token) => {
      // Get unread notifications with minimal fields to count them
      const result = await callWordPressAPI('/notifications?unread=true&fields=id&number=99', token);
      
      if (result && result.notes) {
        return {
          unread_count: result.notes.length,
          total_count: result.total || result.notes.length,
        };
      }
      
      return { unread_count: 0, total_count: 0 };
    },
  },
};