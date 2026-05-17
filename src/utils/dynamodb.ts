import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// DynamoDBDocumentClient を使う理由:
// 生の DynamoDBClient は { S: "value" } のような型注釈が必要で冗長。
// DocumentClient はネイティブなJS型で読み書きできる。
const client = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

export const TABLES = {
  USERS: process.env.USERS_TABLE!,
  SHIFTS: process.env.SHIFTS_TABLE!,
  SHIFT_REQUESTS: process.env.SHIFT_REQUESTS_TABLE!,
  SWAP_REQUESTS: process.env.SWAP_REQUESTS_TABLE!,
} as const;
