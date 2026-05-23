// DynamoDBの操作に必要な道具を読み込む
import { BatchGetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAuthContext, isAdmin } from '../../middleware/auth';
import { docClient, TABLES } from '../../utils/dynamodb';
import { forbidden, internalError, ok, unauthorized } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const auth = getAuthContext(event);
  if (!auth) return unauthorized();
  if (!isAdmin(auth)) return forbidden('Admin access required');

  try {
    const { month } = event.queryStringParameters ?? {};

    // ① ShiftRequestsテーブルから希望一覧を取得
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLES.SHIFT_REQUESTS,
        ...(month && {
          FilterExpression: '#m = :month',
          ExpressionAttributeNames: { '#m': 'month' },
          ExpressionAttributeValues: { ':month': month },
        }),
      }),
    );

    const wishes = result.Items ?? [];

    // ② 希望データから重複しないuserIdの一覧を作る
    const userIds = [...new Set(wishes.map(w => w.userId))];

    // ③ userIdが1件もなければそのまま返す
    if (userIds.length === 0) {
      return ok({ wishes });
    }

    // ④ UsersテーブルからuserIdに対応するユーザー情報を一括取得
    const usersResult = await docClient.send(
      new BatchGetCommand({
        RequestItems: {
          [TABLES.USERS]: {
            Keys: userIds.map(userId => ({ userId })),
          },
        },
      }),
    );

    const users = usersResult.Responses?.[TABLES.USERS] ?? [];

    // ⑤ userIdをキーにしたMapを作って検索しやすくする
    const userMap = new Map(users.map(u => [u.userId, u]));

    // ⑥ 希望データに名前とメールを追加
    const wishesWithName = wishes.map(wish => ({
      ...wish,
      name: userMap.get(wish.userId)?.name ?? '不明',
      email: userMap.get(wish.userId)?.email ?? '',
    }));

    return ok({ wishes: wishesWithName });

  } catch (err) {
    console.error('[getAdminWishes] error:', err);
    return internalError();
  }
};