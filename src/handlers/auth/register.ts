// Cognitoの操作に必要な道具を読み込む
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  AdminConfirmSignUpCommand,
  AdminAddUserToGroupCommand,
  UsernameExistsException,
  InvalidPasswordException,
} from '@aws-sdk/client-cognito-identity-provider';

// DynamoDBの操作に必要な道具を読み込む
import { PutCommand } from '@aws-sdk/lib-dynamodb';

// AWS Lambdaの型定義を読み込む
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// DynamoDB接続を読み込む
import { docClient, TABLES } from '../../utils/dynamodb';

// レスポンス関数を読み込む
import { badRequest, created, internalError } from '../../utils/response';

// Cognitoクライアントを作成
const cognito = new CognitoIdentityProviderClient({});

// フロントから受け取るデータの設計図
interface RegisterBody {
  email: string;
  password: string;
  name: string;
  role?: 'admin' | 'staff';  // 任意。デフォルトはstaff
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  
  // ① bodyが存在するか確認
  if (!event.body) return badRequest('Request body is required');

  // ② JSONを解析
  let body: RegisterBody;
  try {
    body = JSON.parse(event.body) as RegisterBody;
  } catch {
    return badRequest('Invalid JSON');
  }

  // ③ 必須項目のチェック
  const { email, password, name, role = 'staff' } = body;
  if (!email || !password || !name) {
    return badRequest('email, password, name are required');
  }

  try {
    // ④ Cognitoにユーザーを登録
    const signUpResult = await cognito.send(
      new SignUpCommand({
        ClientId: process.env.USER_POOL_CLIENT_ID!,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
        ],
      }),
    );

    const userId = signUpResult.UserSub!;

    // ⑤ メール認証をスキップして即座に有効化
    await cognito.send(
      new AdminConfirmSignUpCommand({
        UserPoolId: process.env.USER_POOL_ID!,
        Username: email,
      }),
    );

    // ⑥ adminかstaffグループに追加
    await cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: process.env.USER_POOL_ID!,
        Username: email,
        GroupName: role,
      }),
    );

    // ⑦ Usersテーブルに名前などを保存
    await docClient.send(
      new PutCommand({
        TableName: TABLES.USERS,
        Item: {
          userId,
          email,
          name,
          role,
          createdAt: new Date().toISOString(),
        },
      }),
    );

    // ⑧ 成功レスポンスを返す
    return created({
      message: 'アカウントを作成しました',
      userId,
      email,
      name,
      role,
    });

  } catch (err) {
    // メールが既に登録済みの場合
    if (err instanceof UsernameExistsException) {
      return badRequest('このメールアドレスは既に登録されています');
    }
    // パスワードがポリシーを満たしていない場合
    if (err instanceof InvalidPasswordException) {
      return badRequest('パスワードは8文字以上で大文字・小文字・数字を含めてください');
    }
    console.error('[register] error:', err);
    return internalError();
  }
};