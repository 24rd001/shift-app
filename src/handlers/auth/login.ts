import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  NotAuthorizedException,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { badRequest, internalError, ok, unauthorized } from '../../utils/response';

const cognito = new CognitoIdentityProviderClient({});

interface LoginBody {
  email: string;
  password: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (!event.body) return badRequest('Request body is required');

  let body: LoginBody;
  try {
    body = JSON.parse(event.body) as LoginBody;
  } catch {
    return badRequest('Invalid JSON');
  }

  const { email, password } = body;
  if (!email || !password) return badRequest('email and password are required');

  try {
    const result = await cognito.send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: process.env.USER_POOL_CLIENT_ID!,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      }),
    );

    if (!result.AuthenticationResult) {
      return unauthorized('Authentication challenge required');
    }

    return ok({
      idToken: result.AuthenticationResult.IdToken,
      accessToken: result.AuthenticationResult.AccessToken,
      refreshToken: result.AuthenticationResult.RefreshToken,
      expiresIn: result.AuthenticationResult.ExpiresIn,
    });
  } catch (err) {
    // セキュリティ上、「メールが存在しない」と「パスワード違い」は同じエラーメッセージにする
    if (err instanceof NotAuthorizedException || err instanceof UserNotFoundException) {
      return unauthorized('Invalid email or password');
    }
    console.error('[login] unexpected error:', err);
    return internalError();
  }
};
