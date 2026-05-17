import { APIGatewayProxyEvent } from 'aws-lambda';

export interface AuthContext {
  userId: string;
  email: string;
  groups: string[];
}

// API Gatewayの Cognito Authorizer が検証済みのJWTクレームを
// event.requestContext.authorizer.claims に注入する。
// Lambdaはトークン検証を自前で行わなくてよい（Cognitoが保証済み）。
export const getAuthContext = (event: APIGatewayProxyEvent): AuthContext | null => {
  const claims = event.requestContext.authorizer?.claims;
  if (!claims) return null;

  // cognito:groups はスペースなしのカンマ区切り文字列として渡される
  // 例: "admin,staff" または単一グループの場合は "staff"
  const groupsRaw: string | undefined = claims['cognito:groups'];
  const groups = groupsRaw
    ? groupsRaw.split(',').map((g) => g.trim()).filter(Boolean)
    : [];

  return {
    userId: claims['sub'] as string,
    email: claims['email'] as string,
    groups,
  };
};

export const isAdmin = (auth: AuthContext): boolean =>
  auth.groups.includes('admin');
