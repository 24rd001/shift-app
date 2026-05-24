// DynamoDBの操作に必要な道具を読み込む
import { ScanCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';

// AWS Lambdaの型定義を読み込む
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// 認証チェック用の関数を読み込む
import { getAuthContext, isAdmin } from '../../middleware/auth';

// DynamoDB接続を読み込む
import { docClient, TABLES } from '../../utils/dynamodb';

// レスポンス関数を読み込む
import { forbidden, internalError, ok, unauthorized } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  
  // ① ログイン済みか確認
  const auth = getAuthContext(event);
  if (!auth) return unauthorized();
  
  // ② adminかチェック
  if (!isAdmin(auth)) return forbidden('Admin access required');

  try {
    // ③ SwapRequestsテーブルから全件取得
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLES.SWAP_REQUESTS,
      }),
    );

    const swaps = result.Items ?? [];

    if (swaps.length === 0) {
      return ok({ swaps });
    }

    // ④ 申請者のuserIdとシフトのshiftIdの一覧を作る
    const requesterIds = [...new Set(swaps.map(s => s.requesterId))];
    const shiftIds = [...new Set(swaps.map(s => s.shiftId))];

    // ⑤ Usersテーブルから申請者の情報を一括取得
    const usersResult = await docClient.send(
      new BatchGetCommand({
        RequestItems: {
          [TABLES.USERS]: {
            Keys: requesterIds.map(userId => ({ userId })),
          },
        },
      }),
    );

    const users = usersResult.Responses?.[TABLES.USERS] ?? [];
    const userMap = new Map(users.map(u => [u.userId, u]));

    // ⑥ Shiftsテーブルからシフト情報を一括取得
    const shiftsResult = await docClient.send(
      new BatchGetCommand({
        RequestItems: {
          [TABLES.SHIFTS]: {
            Keys: shiftIds.map(shiftId => ({ shiftId })),
          },
        },
      }),
    );

    const shifts = shiftsResult.Responses?.[TABLES.SHIFTS] ?? [];
    const shiftMap = new Map(shifts.map(s => [s.shiftId, s]));

    // ⑦ 各申請に申請者の名前とシフト情報を追加
    const swapsWithDetails = swaps.map(swap => {
      const shift = shiftMap.get(swap.shiftId);
      return {
        ...swap,
        requesterName: userMap.get(swap.requesterId)?.name ?? '不明',
        requesterEmail: userMap.get(swap.requesterId)?.email ?? '',
        date: shift?.date ?? null,
        startTime: shift?.startTime ?? null,
        endTime: shift?.endTime ?? null,
      };
    });

    return ok({ swaps: swapsWithDetails });

  } catch (err) {
    console.error('[getAdminSwapRequests] error:', err);
    return internalError();
  }
};