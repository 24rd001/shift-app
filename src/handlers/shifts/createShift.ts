// DynamoDBの操作に必要な道具を読み込む
import { PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

// AWS Lambdaの型定義を読み込む
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// ランダムなIDを作るための道具
import { v4 as uuidv4 } from 'uuid';

// 認証チェック用の関数を読み込む
import { getAuthContext, isAdmin } from '../../middleware/auth';

// DynamoDB接続を読み込む
import { docClient, TABLES } from '../../utils/dynamodb';

// レスポンス関数を読み込む
import { badRequest, created, forbidden, internalError, notFound, unauthorized } from '../../utils/response';

// フロントから受け取るデータの設計図
interface CreateShiftBody {
  email: string;
  date: string;
  startTime: string;
  endTime: string;
  note?: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  
  // ① ログイン済みか確認
  const auth = getAuthContext(event);
  if (!auth) return unauthorized();
  
  // ② adminかチェック
  if (!isAdmin(auth)) return forbidden('Admin access required');

  // ③ bodyが存在するか確認
  if (!event.body) return badRequest('Request body is required');

  // ④ JSONを解析
  let body: CreateShiftBody;
  try {
    body = JSON.parse(event.body) as CreateShiftBody;
  } catch {
    return badRequest('Invalid JSON');
  }

  // ⑤ 必須項目のチェック
  const { email, date, startTime, endTime, note } = body;
  if (!email || !date || !startTime || !endTime) {
    return badRequest('email, date, startTime, endTime are required');
  }

  try {
    // ⑥ Usersテーブルからemailでユーザーを検索
    const userResult = await docClient.send(
      new ScanCommand({
        TableName: TABLES.USERS,
        FilterExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': email },
      }),
    );

    // ⑦ ユーザーが見つからなければエラー
    if (!userResult.Items || userResult.Items.length === 0) {
      return notFound('このメールアドレスのスタッフが見つかりません');
    }

    const userId = userResult.Items[0].userId;
    const userName = userResult.Items[0].name;

    // ⑧ DynamoDBに保存するシフトデータを作成
    const item = {
      shiftId: uuidv4(),
      userId,
      userName,
      date,
      startTime,
      endTime,
      note: note ?? null,
      status: 'scheduled',
      createdBy: auth.userId,
      createdAt: new Date().toISOString(),
    };

    // ⑨ Shiftsテーブルに保存
    await docClient.send(
      new PutCommand({
        TableName: TABLES.SHIFTS,
        Item: item,
      }),
    );

    // ⑩ 成功レスポンスを返す
    return created({ shift: item });

  } catch (err) {
    console.error('[createShift] error:', err);
    return internalError();
  }
};