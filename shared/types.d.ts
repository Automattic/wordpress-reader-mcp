export interface TokenInfo {
    access_token: string;
    token_type: string;
    blog_id: string;
    blog_url: string;
    scope: string;
}
export interface MCPToken {
    id: string;
    wordpress_token: string;
    expires_at: number;
    user_info: {
        blog_id: string;
        blog_url: string;
    };
}
export interface OAuthConfig {
    client_id: string;
    client_secret: string;
    redirect_uri: string;
    authorization_base_url: string;
    token_url: string;
}
//# sourceMappingURL=types.d.ts.map