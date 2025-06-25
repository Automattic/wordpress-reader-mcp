import { callWordPressAPI, checkBlogConfidentiality } from './wordpress-api.js';

interface Tool {
  description: string;
  inputSchema: Record<string, any>;
  handler: (args: any, token: string) => Promise<any>;
}

// Helper function to create confidentiality error response
function createConfidentialityError(site: string): Error {
  return new Error(`Access to content from ${site} is restricted due to confidentiality settings. This blog does not have the p2_confidentiality_disabled sticker, which means AI access to its content is not permitted.`);
}

export const readerTools: Record<string, Tool> = {
  getReaderMenu: {
    description: 'Retrieve the WordPress Reader default menu with recommended tags, followed sites, and Reader sections for content discovery',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (_args, token) => {
      return callWordPressAPI('/read/menu', token);
    },
  },

  getFeed: {
    description: 'Get comprehensive details about a WordPress feed including metadata, subscriber count, and feed configuration by URL or ID',
    inputSchema: {
      type: 'object',
      properties: {
        feed_url_or_id: {
          type: 'string',
          description: 'Feed URL (e.g., https://example.com/feed) or WordPress.com feed ID',
        },
      },
      required: ['feed_url_or_id'],
    },
    handler: async (args, token) => {
      return callWordPressAPI(`/read/feed/${encodeURIComponent(args.feed_url_or_id)}`, token);
    },
  },

  getReaderPost: {
    description: 'Retrieve a single blog post from the WordPress Reader with full content, metadata, and engagement stats',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'WordPress site domain (e.g., example.wordpress.com) or numeric site ID',
        },
        post_id: {
          type: 'string',
          description: 'Unique post identifier (numeric ID)',
        },
        include_content: {
          type: 'boolean',
          description: 'Whether to include the full content field in the response. Defaults to false to avoid large HTML content. Set to true only when content is specifically needed.',
        },
      },
      required: ['site', 'post_id'],
    },
    handler: async (args, token) => {
      // Check blog confidentiality if it's a WordPress.com site
      if (args.site.includes('.wordpress.com')) {
        const isAccessible = await checkBlogConfidentiality(args.site, token);
        if (!isAccessible) {
          throw createConfidentialityError(args.site);
        }
      }
      // Handle content exclusion logic - exclude content by default unless explicitly requested
      const params = new URLSearchParams();
      if (args.include_content === false || args.include_content === undefined) {
        params.append('fields', 'ID,site_ID,author,date,modified,title,URL,short_URL,excerpt,slug,guid,status,discussion,likes_enabled,sharing_enabled,like_count,i_like,is_reblogged,is_following,global_ID,featured_image,post_thumbnail,format,tags,categories,attachments,attachment_count,metadata,meta,feed_ID,feed_URL,pseudo_ID,is_external,site_name,site_URL,site_is_private,site_is_atomic,site_icon,featured_media,is_subscribed_comments,can_subscribe_comments,subscribed_comments_notifications,publish_date_changed,use_excerpt,capabilities,is_seen,is_jetpack,feed_item_ID,word_count,views,is_following_conversation');
      }
      
      return callWordPressAPI(`/read/sites/${args.site}/posts/${args.post_id}?${params}`, token);
    },
  },

  getFollowingPosts: {
    description: 'Retrieve recent posts from all blogs and sites that the authenticated user follows in their WordPress Reader feed',
    inputSchema: {
      type: 'object',
      properties: {
        number: {
          type: 'number',
          description: 'Number of posts to return (default: 20, maximum: 100)',
        },
        page: {
          type: 'number',
          description: 'Page number for pagination (starts from 1)',
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
    description: 'Retrieve posts that the authenticated user has liked across the WordPress platform, with engagement history',
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
    handler: async (_args, token) => {
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
    handler: async (_args, token) => {
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
      // Check blog confidentiality if it's a WordPress.com site
      if (args.site_url.includes('.wordpress.com')) {
        // Extract the domain from the URL
        try {
          const url = new URL(args.site_url);
          const isAccessible = await checkBlogConfidentiality(url.hostname, token);
          if (!isAccessible) {
            throw createConfidentialityError(url.hostname);
          }
        } catch (error) {
          // If URL parsing fails, let the API handle it
        }
      }
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
      // Check blog confidentiality if it's a WordPress.com site
      if (args.site_url.includes('.wordpress.com')) {
        // Extract the domain from the URL
        try {
          const url = new URL(args.site_url);
          const isAccessible = await checkBlogConfidentiality(url.hostname, token);
          if (!isAccessible) {
            throw createConfidentialityError(url.hostname);
          }
        } catch (error) {
          // If URL parsing fails, let the API handle it
        }
      }
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
    description: 'Get a8c posts from the blogs an a11n user follows. User must be an a11n.',
    inputSchema: {
      type: 'object',
      properties: {
        number: {
          type: 'number',
          description: 'The number of posts to return. Limit: 40. (default: 10)',
        },
        page: {
          type: 'number',
          description: 'Return the Nth 1-indexed page of posts.',
        },
        order: {
          type: 'string',
          description: 'Return posts in ascending or descending order. For dates, DESC means newest to oldest, ASC means oldest to newest.',
          enum: ['DESC', 'ASC'],
        },
        after: {
          type: 'string',
          description: 'Return posts dated after the specified datetime (ISO 8601 format).',
        },
        before: {
          type: 'string',
          description: 'Return posts dated before the specified datetime (ISO 8601 format).',
        },
        fields: {
          type: 'string',
          description: 'Comma-separated list of specific fields to return for each post. Available fields include: ID, site_ID, author, date, modified, title, URL, short_URL, excerpt, slug, guid, status, discussion, likes_enabled, sharing_enabled, like_count, i_like, is_reblogged, is_following, global_ID, featured_image, post_thumbnail, format, tags, categories, attachments, attachment_count, metadata, meta, feed_ID, feed_URL, pseudo_ID, is_external, site_name, site_URL, site_is_private, site_is_atomic, site_icon, featured_media, is_subscribed_comments, can_subscribe_comments, subscribed_comments_notifications, publish_date_changed, use_excerpt, capabilities, is_seen, is_jetpack, feed_item_ID, word_count, views, is_following_conversation.',
        },
        include_content: {
          type: 'boolean',
          description: 'Whether to include the full content field in the response. Defaults to false to avoid large HTML content. Set to true only when content is specifically needed.',
        },
      },
    },
    handler: async (args, token) => {
      const params = new URLSearchParams();
      if (args.number) params.append('number', Math.min(args.number, 40).toString());
      if (args.page) params.append('page', args.page.toString());
      if (args.order) params.append('order', args.order);
      if (args.after) params.append('after', args.after);
      if (args.before) params.append('before', args.before);
      
      // Handle fields parameter with content exclusion logic
      if (args.fields) {
        // If include_content is false (default), ensure content is not in the fields list
        if (args.include_content === false || args.include_content === undefined) {
          const fieldsArray = args.fields.split(',').map((f: string) => f.trim());
          const filteredFields = fieldsArray.filter((field: string) => field !== 'content');
          params.append('fields', filteredFields.join(','));
        } else {
          params.append('fields', args.fields);
        }
      } else if (args.include_content === false || args.include_content === undefined) {
        // If no fields specified but include_content is false, exclude content by default
        // This ensures content is not included even when fields parameter is not used
        params.append('fields', 'ID,site_ID,author,date,modified,title,URL,short_URL,excerpt,slug,guid,status,discussion,likes_enabled,sharing_enabled,like_count,i_like,is_reblogged,is_following,global_ID,featured_image,post_thumbnail,format,tags,categories,attachments,attachment_count,metadata,meta,feed_ID,feed_URL,pseudo_ID,is_external,site_name,site_URL,site_is_private,site_is_atomic,site_icon,featured_media,is_subscribed_comments,can_subscribe_comments,subscribed_comments_notifications,publish_date_changed,use_excerpt,capabilities,is_seen,is_jetpack,feed_item_ID,word_count,views,is_following_conversation');
      }
      
      return callWordPressAPI(`/read/a8c?${params}`, token);
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
    handler: async (_args, token) => {
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

  // Comments API Tools
  getPostComments: {
    description: 'Get comments for a specific post',
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
        number: {
          type: 'number',
          description: 'Number of comments to retrieve (default: 20)',
        },
        order: {
          type: 'string',
          description: 'Order of comments: ASC or DESC (default: DESC)',
          enum: ['ASC', 'DESC'],
        },
        status: {
          type: 'string',
          description: 'Filter by comment status: approved, pending, spam, trash, all (default: approved)',
          enum: ['approved', 'pending', 'spam', 'trash', 'all'],
        },
      },
      required: ['site', 'post_id'],
    },
    handler: async (args, token) => {
      // Check blog confidentiality if it's a WordPress.com site
      if (args.site.includes('.wordpress.com')) {
        const isAccessible = await checkBlogConfidentiality(args.site, token);
        if (!isAccessible) {
          throw createConfidentialityError(args.site);
        }
      }
      const params = new URLSearchParams();
      if (args.number) params.append('number', args.number.toString());
      if (args.order) params.append('order', args.order);
      if (args.status) params.append('status', args.status);
      
      return callWordPressAPI(`/sites/${args.site}/posts/${args.post_id}/replies?${params}`, token);
    },
  },

  getComment: {
    description: 'Get a specific comment by ID',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site domain or ID',
        },
        comment_id: {
          type: 'string',
          description: 'Comment ID',
        },
      },
      required: ['site', 'comment_id'],
    },
    handler: async (args, token) => {
      // Check blog confidentiality if it's a WordPress.com site
      if (args.site.includes('.wordpress.com')) {
        const isAccessible = await checkBlogConfidentiality(args.site, token);
        if (!isAccessible) {
          throw createConfidentialityError(args.site);
        }
      }
      return callWordPressAPI(`/sites/${args.site}/comments/${args.comment_id}`, token);
    },
  },

  createComment: {
    description: 'Create a new comment on a post',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site domain or ID',
        },
        post_id: {
          type: 'string',
          description: 'Post ID to comment on',
        },
        content: {
          type: 'string',
          description: 'Comment content',
        },
        parent: {
          type: 'string',
          description: 'Parent comment ID (for replies)',
        },
      },
      required: ['site', 'post_id', 'content'],
    },
    handler: async (args, token) => {
      // Check blog confidentiality if it's a WordPress.com site
      if (args.site.includes('.wordpress.com')) {
        const isAccessible = await checkBlogConfidentiality(args.site, token);
        if (!isAccessible) {
          throw createConfidentialityError(args.site);
        }
      }
      const body: any = {
        content: args.content,
      };
      
      if (args.parent) {
        body.parent = args.parent;
      }
      
      return callWordPressAPI(`/sites/${args.site}/posts/${args.post_id}/replies/new`, token, 'POST', body);
    },
  },

  replyToComment: {
    description: 'Reply to an existing comment',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site domain or ID',
        },
        comment_id: {
          type: 'string',
          description: 'Comment ID to reply to',
        },
        content: {
          type: 'string',
          description: 'Reply content',
        },
      },
      required: ['site', 'comment_id', 'content'],
    },
    handler: async (args, token) => {
      // Check blog confidentiality if it's a WordPress.com site
      if (args.site.includes('.wordpress.com')) {
        const isAccessible = await checkBlogConfidentiality(args.site, token);
        if (!isAccessible) {
          throw createConfidentialityError(args.site);
        }
      }
      return callWordPressAPI(`/sites/${args.site}/comments/${args.comment_id}/replies/new`, token, 'POST', {
        content: args.content,
      });
    },
  },

  likeComment: {
    description: 'Like a comment',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site domain or ID',
        },
        comment_id: {
          type: 'string',
          description: 'Comment ID to like',
        },
      },
      required: ['site', 'comment_id'],
    },
    handler: async (args, token) => {
      // Check blog confidentiality if it's a WordPress.com site
      if (args.site.includes('.wordpress.com')) {
        const isAccessible = await checkBlogConfidentiality(args.site, token);
        if (!isAccessible) {
          throw createConfidentialityError(args.site);
        }
      }
      return callWordPressAPI(`/sites/${args.site}/comments/${args.comment_id}/likes/new`, token, 'POST');
    },
  },

  unlikeComment: {
    description: 'Unlike a comment',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site domain or ID',
        },
        comment_id: {
          type: 'string',
          description: 'Comment ID to unlike',
        },
      },
      required: ['site', 'comment_id'],
    },
    handler: async (args, token) => {
      // Check blog confidentiality if it's a WordPress.com site
      if (args.site.includes('.wordpress.com')) {
        const isAccessible = await checkBlogConfidentiality(args.site, token);
        if (!isAccessible) {
          throw createConfidentialityError(args.site);
        }
      }
      return callWordPressAPI(`/sites/${args.site}/comments/${args.comment_id}/likes/mine/delete`, token, 'POST');
    },
  },

  getSiteComments: {
    description: 'Get all comments for a site',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site domain or ID',
        },
        number: {
          type: 'number',
          description: 'Number of comments to retrieve (default: 20)',
        },
        order: {
          type: 'string',
          description: 'Order of comments: ASC or DESC (default: DESC)',
          enum: ['ASC', 'DESC'],
        },
        status: {
          type: 'string',
          description: 'Filter by comment status: approved, pending, spam, trash, all (default: approved)',
          enum: ['approved', 'pending', 'spam', 'trash', 'all'],
        },
        type: {
          type: 'string',
          description: 'Filter by comment type: comment, trackback, pingback, review (default: comment)',
          enum: ['comment', 'trackback', 'pingback', 'review'],
        },
      },
      required: ['site'],
    },
    handler: async (args, token) => {
      // Check blog confidentiality if it's a WordPress.com site
      if (args.site.includes('.wordpress.com')) {
        const isAccessible = await checkBlogConfidentiality(args.site, token);
        if (!isAccessible) {
          throw createConfidentialityError(args.site);
        }
      }
      const params = new URLSearchParams();
      if (args.number) params.append('number', args.number.toString());
      if (args.order) params.append('order', args.order);
      if (args.status) params.append('status', args.status);
      if (args.type) params.append('type', args.type);
      
      return callWordPressAPI(`/sites/${args.site}/comments?${params}`, token);
    },
  },

  updateComment: {
    description: 'Update a comment (if you have permission)',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site domain or ID',
        },
        comment_id: {
          type: 'string',
          description: 'Comment ID to update',
        },
        content: {
          type: 'string',
          description: 'New comment content',
        },
        status: {
          type: 'string',
          description: 'Comment status: approved, pending, spam, trash',
          enum: ['approved', 'pending', 'spam', 'trash'],
        },
      },
      required: ['site', 'comment_id'],
    },
    handler: async (args, token) => {
      // Check blog confidentiality if it's a WordPress.com site
      if (args.site.includes('.wordpress.com')) {
        const isAccessible = await checkBlogConfidentiality(args.site, token);
        if (!isAccessible) {
          throw createConfidentialityError(args.site);
        }
      }
      const body: any = {};
      
      if (args.content) {
        body.content = args.content;
      }
      
      if (args.status) {
        body.status = args.status;
      }
      
      return callWordPressAPI(`/sites/${args.site}/comments/${args.comment_id}`, token, 'POST', body);
    },
  },

  deleteComment: {
    description: 'Permanently delete a specific comment from a WordPress site (requires proper authorization and ownership)',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'WordPress site domain (e.g., example.wordpress.com) or numeric site ID',
        },
        comment_id: {
          type: 'string',
          description: 'Unique identifier of the comment to delete',
        },
      },
      required: ['site', 'comment_id'],
    },
    handler: async (args, token) => {
      // Check blog confidentiality if it's a WordPress.com site
      if (args.site.includes('.wordpress.com')) {
        const isAccessible = await checkBlogConfidentiality(args.site, token);
        if (!isAccessible) {
          throw createConfidentialityError(args.site);
        }
      }
      return callWordPressAPI(`/sites/${args.site}/comments/${args.comment_id}/delete`, token, 'POST');
    },
  },

  // Posts API Tools - Complete WordPress.com Posts Management
  createPost: {
    description: 'Create a new blog post on a WordPress site with full content, metadata, and publishing options',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'WordPress site domain (e.g., example.wordpress.com) or numeric site ID where the post will be created',
        },
        title: {
          type: 'string',
          description: 'Post title (HTML allowed for formatting)',
        },
        content: {
          type: 'string',
          description: 'Post content/body (HTML allowed, supports WordPress shortcodes)',
        },
        excerpt: {
          type: 'string',
          description: 'Post excerpt/summary (optional, auto-generated if not provided)',
        },
        status: {
          type: 'string',
          description: 'Publishing status of the post',
          enum: ['publish', 'draft', 'pending', 'private', 'auto-draft'],
        },
        date: {
          type: 'string',
          description: 'Publication date in ISO 8601 format (e.g., 2024-01-15T10:30:00Z). Future dates schedule the post.',
        },
        categories: {
          type: 'string',
          description: 'Comma-separated list of category names or IDs',
        },
        tags: {
          type: 'string',
          description: 'Comma-separated list of tag names',
        },
        featured_image: {
          type: 'string',
          description: 'URL of the featured image or WordPress media ID',
        },
        format: {
          type: 'string',
          description: 'Post format type',
          enum: ['standard', 'aside', 'gallery', 'link', 'image', 'quote', 'status', 'video', 'audio', 'chat'],
        },
        slug: {
          type: 'string',
          description: 'Custom URL slug (permalink). Auto-generated from title if not provided.',
        },
        password: {
          type: 'string',
          description: 'Password for password-protected posts',
        },
        sticky: {
          type: 'boolean',
          description: 'Whether to make this post sticky (featured at top of blog)',
        },
      },
      required: ['site', 'title', 'content'],
    },
    handler: async (args, token) => {
      // Check blog confidentiality if it's a WordPress.com site
      if (args.site.includes('.wordpress.com')) {
        const isAccessible = await checkBlogConfidentiality(args.site, token);
        if (!isAccessible) {
          throw createConfidentialityError(args.site);
        }
      }
      const body: any = {
        title: args.title,
        content: args.content,
      };
      
      // Add optional fields
      if (args.excerpt) body.excerpt = args.excerpt;
      if (args.status) body.status = args.status;
      if (args.date) body.date = args.date;
      if (args.categories) body.categories = args.categories;
      if (args.tags) body.tags = args.tags;
      if (args.featured_image) body.featured_image = args.featured_image;
      if (args.format) body.format = args.format;
      if (args.slug) body.slug = args.slug;
      if (args.password) body.password = args.password;
      if (args.sticky !== undefined) body.sticky = args.sticky;
      
      return callWordPressAPI(`/sites/${args.site}/posts/new`, token, 'POST', body);
    },
  },

  getSitePost: {
    description: 'Retrieve a specific WordPress post with complete content, metadata, and engagement statistics from any site',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'WordPress site domain (e.g., example.wordpress.com) or numeric site ID',
        },
        post_id: {
          type: 'string',
          description: 'Unique post identifier (numeric ID)',
        },
        context: {
          type: 'string',
          description: 'Response context: "display" for rendered HTML, "edit" for raw content with editing metadata',
          enum: ['display', 'edit'],
        },
        include_content: {
          type: 'boolean',
          description: 'Whether to include the full content field in the response. Defaults to false to avoid large HTML content. Set to true only when content is specifically needed.',
        },
      },
      required: ['site', 'post_id'],
    },
    handler: async (args, token) => {
      // Check blog confidentiality if it's a WordPress.com site
      if (args.site.includes('.wordpress.com')) {
        const isAccessible = await checkBlogConfidentiality(args.site, token);
        if (!isAccessible) {
          throw createConfidentialityError(args.site);
        }
      }
      const params = new URLSearchParams();
      if (args.context) params.append('context', args.context);
      
      // Handle content exclusion logic - exclude content by default unless explicitly requested
      if (args.include_content === false || args.include_content === undefined) {
        params.append('fields', 'ID,date,modified,title,URL,short_URL,excerpt,slug,status,sticky,password,parent,type,discussion,likes_enabled,sharing_enabled,like_count,i_like,is_reblogged,is_following,global_ID,featured_image,post_thumbnail,format,geo,menu_order,page_template,publicize_URLs,terms,tags,categories,attachments,attachment_count,metadata,author');
      }
      
      return callWordPressAPI(`/sites/${args.site}/posts/${args.post_id}?${params}`, token);
    },
  },

  getPostBySlug: {
    description: 'Retrieve a WordPress post by its URL slug instead of numeric ID, useful for accessing posts by permalink',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'WordPress site domain (e.g., example.wordpress.com) or numeric site ID',
        },
        slug: {
          type: 'string',
          description: 'Post URL slug (the part after the domain in the permalink, e.g., "my-blog-post")',
        },
        context: {
          type: 'string',
          description: 'Response context: "display" for rendered HTML, "edit" for raw content',
          enum: ['display', 'edit'],
        },
        include_content: {
          type: 'boolean',
          description: 'Whether to include the full content field in the response. Defaults to false to avoid large HTML content. Set to true only when content is specifically needed.',
        },
      },
      required: ['site', 'slug'],
    },
    handler: async (args, token) => {
      // Check blog confidentiality if it's a WordPress.com site
      if (args.site.includes('.wordpress.com')) {
        const isAccessible = await checkBlogConfidentiality(args.site, token);
        if (!isAccessible) {
          throw createConfidentialityError(args.site);
        }
      }
      const params = new URLSearchParams();
      if (args.context) params.append('context', args.context);
      
      // Handle content exclusion logic - exclude content by default unless explicitly requested
      if (args.include_content === false || args.include_content === undefined) {
        params.append('fields', 'ID,date,modified,title,URL,short_URL,excerpt,slug,status,sticky,password,parent,type,discussion,likes_enabled,sharing_enabled,like_count,i_like,is_reblogged,is_following,global_ID,featured_image,post_thumbnail,format,geo,menu_order,page_template,publicize_URLs,terms,tags,categories,attachments,attachment_count,metadata,author');
      }
      
      return callWordPressAPI(`/sites/${args.site}/posts/slug:${args.slug}?${params}`, token);
    },
  },

  updatePost: {
    description: 'Update an existing WordPress post with new content, metadata, or publishing settings (requires author permissions)',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'WordPress site domain (e.g., example.wordpress.com) or numeric site ID',
        },
        post_id: {
          type: 'string',
          description: 'Unique identifier of the post to update',
        },
        title: {
          type: 'string',
          description: 'Updated post title',
        },
        content: {
          type: 'string',
          description: 'Updated post content/body (HTML allowed)',
        },
        excerpt: {
          type: 'string',
          description: 'Updated post excerpt/summary',
        },
        status: {
          type: 'string',
          description: 'Updated publishing status',
          enum: ['publish', 'draft', 'pending', 'private', 'trash'],
        },
        date: {
          type: 'string',
          description: 'Updated publication date in ISO 8601 format',
        },
        categories: {
          type: 'string',
          description: 'Updated comma-separated list of category names or IDs',
        },
        tags: {
          type: 'string',
          description: 'Updated comma-separated list of tag names',
        },
        featured_image: {
          type: 'string',
          description: 'Updated featured image URL or WordPress media ID',
        },
        slug: {
          type: 'string',
          description: 'Updated URL slug (permalink)',
        },
        sticky: {
          type: 'boolean',
          description: 'Updated sticky status',
        },
      },
      required: ['site', 'post_id'],
    },
    handler: async (args, token) => {
      // Check blog confidentiality if it's a WordPress.com site
      if (args.site.includes('.wordpress.com')) {
        const isAccessible = await checkBlogConfidentiality(args.site, token);
        if (!isAccessible) {
          throw createConfidentialityError(args.site);
        }
      }
      const body: any = {};
      
      // Add only provided fields to update
      if (args.title) body.title = args.title;
      if (args.content) body.content = args.content;
      if (args.excerpt) body.excerpt = args.excerpt;
      if (args.status) body.status = args.status;
      if (args.date) body.date = args.date;
      if (args.categories) body.categories = args.categories;
      if (args.tags) body.tags = args.tags;
      if (args.featured_image) body.featured_image = args.featured_image;
      if (args.slug) body.slug = args.slug;
      if (args.sticky !== undefined) body.sticky = args.sticky;
      
      return callWordPressAPI(`/sites/${args.site}/posts/${args.post_id}`, token, 'POST', body);
    },
  },

  deletePost: {
    description: 'Delete a WordPress post (first call moves to trash, second call permanently deletes - requires author permissions)',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'WordPress site domain (e.g., example.wordpress.com) or numeric site ID',
        },
        post_id: {
          type: 'string',
          description: 'Unique identifier of the post to delete',
        },
      },
      required: ['site', 'post_id'],
    },
    handler: async (args, token) => {
      // Check blog confidentiality if it's a WordPress.com site
      if (args.site.includes('.wordpress.com')) {
        const isAccessible = await checkBlogConfidentiality(args.site, token);
        if (!isAccessible) {
          throw createConfidentialityError(args.site);
        }
      }
      return callWordPressAPI(`/sites/${args.site}/posts/${args.post_id}/delete`, token, 'POST');
    },
  },

  listPosts: {
    description: 'Retrieve a paginated list of posts from a WordPress site with advanced filtering, sorting, and search capabilities',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'WordPress site domain (e.g., example.wordpress.com) or numeric site ID',
        },
        number: {
          type: 'number',
          description: 'Number of posts to return (default: 20, maximum: 100)',
        },
        offset: {
          type: 'number',
          description: 'Number of posts to skip (for pagination)',
        },
        page: {
          type: 'number',
          description: 'Page number (alternative to offset)',
        },
        order: {
          type: 'string',
          description: 'Sort order for results',
          enum: ['ASC', 'DESC'],
        },
        order_by: {
          type: 'string',
          description: 'Field to sort by',
          enum: ['date', 'modified', 'title', 'comment_count', 'ID'],
        },
        author: {
          type: 'string',
          description: 'Filter by author username or ID',
        },
        tag: {
          type: 'string',
          description: 'Filter by tag name or slug',
        },
        category: {
          type: 'string',
          description: 'Filter by category name or slug',
        },
        status: {
          type: 'string',
          description: 'Filter by post status',
          enum: ['publish', 'private', 'draft', 'pending', 'trash', 'any'],
        },
        search: {
          type: 'string',
          description: 'Search query to filter posts by content and title',
        },
        after: {
          type: 'string',
          description: 'Return posts published after this date (ISO 8601 format)',
        },
        before: {
          type: 'string',
          description: 'Return posts published before this date (ISO 8601 format)',
        },
        sticky: {
          type: 'string',
          description: 'Filter by sticky post status',
          enum: ['include', 'exclude', 'require'],
        },
        include_content: {
          type: 'boolean',
          description: 'Whether to include the full content field in the response. Defaults to false to avoid large HTML content. Set to true only when content is specifically needed.',
        },
      },
      required: ['site'],
    },
    handler: async (args, token) => {
      // Check blog confidentiality if it's a WordPress.com site
      if (args.site.includes('.wordpress.com')) {
        const isAccessible = await checkBlogConfidentiality(args.site, token);
        if (!isAccessible) {
          throw createConfidentialityError(args.site);
        }
      }
      const params = new URLSearchParams();
      if (args.number) params.append('number', args.number.toString());
      if (args.offset) params.append('offset', args.offset.toString());
      if (args.page) params.append('page', args.page.toString());
      if (args.order) params.append('order', args.order);
      if (args.order_by) params.append('order_by', args.order_by);
      if (args.author) params.append('author', args.author);
      if (args.tag) params.append('tag', args.tag);
      if (args.category) params.append('category', args.category);
      if (args.status) params.append('status', args.status);
      if (args.search) params.append('search', args.search);
      if (args.after) params.append('after', args.after);
      if (args.before) params.append('before', args.before);
      if (args.sticky) params.append('sticky', args.sticky);
      
      // Handle content exclusion logic - exclude content by default unless explicitly requested
      if (args.include_content === false || args.include_content === undefined) {
        params.append('fields', 'ID,date,modified,title,URL,short_URL,excerpt,slug,status,sticky,password,parent,type,discussion,likes_enabled,sharing_enabled,like_count,i_like,is_reblogged,is_following,global_ID,featured_image,post_thumbnail,format,geo,menu_order,page_template,publicize_URLs,terms,tags,categories,attachments,attachment_count,metadata,author');
      }
      
      return callWordPressAPI(`/sites/${args.site}/posts?${params}`, token);
    },
  },

  likePost: {
    description: 'Like a WordPress post to show appreciation and add it to your liked posts collection',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'WordPress site domain (e.g., example.wordpress.com) or numeric site ID',
        },
        post_id: {
          type: 'string',
          description: 'Unique identifier of the post to like',
        },
      },
      required: ['site', 'post_id'],
    },
    handler: async (args, token) => {
      // Check blog confidentiality if it's a WordPress.com site
      if (args.site.includes('.wordpress.com')) {
        const isAccessible = await checkBlogConfidentiality(args.site, token);
        if (!isAccessible) {
          throw createConfidentialityError(args.site);
        }
      }
      return callWordPressAPI(`/sites/${args.site}/posts/${args.post_id}/likes/new`, token, 'POST');
    },
  },

  unlikePost: {
    description: 'Remove your like from a WordPress post that you previously liked',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'WordPress site domain (e.g., example.wordpress.com) or numeric site ID',
        },
        post_id: {
          type: 'string',
          description: 'Unique identifier of the post to unlike',
        },
      },
      required: ['site', 'post_id'],
    },
    handler: async (args, token) => {
      // Check blog confidentiality if it's a WordPress.com site
      if (args.site.includes('.wordpress.com')) {
        const isAccessible = await checkBlogConfidentiality(args.site, token);
        if (!isAccessible) {
          throw createConfidentialityError(args.site);
        }
      }
      return callWordPressAPI(`/sites/${args.site}/posts/${args.post_id}/likes/mine/delete`, token, 'POST');
    },
  },

  getPostLikes: {
    description: 'Retrieve a list of users who have liked a specific WordPress post, with pagination support',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'WordPress site domain (e.g., example.wordpress.com) or numeric site ID',
        },
        post_id: {
          type: 'string',
          description: 'Unique identifier of the post to get likes for',
        },
        number: {
          type: 'number',
          description: 'Number of likes to return (default: 20)',
        },
        offset: {
          type: 'number',
          description: 'Number of likes to skip (for pagination)',
        },
      },
      required: ['site', 'post_id'],
    },
    handler: async (args, token) => {
      // Check blog confidentiality if it's a WordPress.com site
      if (args.site.includes('.wordpress.com')) {
        const isAccessible = await checkBlogConfidentiality(args.site, token);
        if (!isAccessible) {
          throw createConfidentialityError(args.site);
        }
      }
      const params = new URLSearchParams();
      if (args.number) params.append('number', args.number.toString());
      if (args.offset) params.append('offset', args.offset.toString());
      
      return callWordPressAPI(`/sites/${args.site}/posts/${args.post_id}/likes?${params}`, token);
    },
  },

  getPostLikeStatus: {
    description: 'Check whether the authenticated user has liked a specific WordPress post',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'WordPress site domain (e.g., example.wordpress.com) or numeric site ID',
        },
        post_id: {
          type: 'string',
          description: 'Unique identifier of the post to check like status for',
        },
      },
      required: ['site', 'post_id'],
    },
    handler: async (args, token) => {
      // Check blog confidentiality if it's a WordPress.com site
      if (args.site.includes('.wordpress.com')) {
        const isAccessible = await checkBlogConfidentiality(args.site, token);
        if (!isAccessible) {
          throw createConfidentialityError(args.site);
        }
      }
      return callWordPressAPI(`/sites/${args.site}/posts/${args.post_id}/likes/mine`, token);
    },
  },
};