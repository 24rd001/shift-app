import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { getAuthContext } from '../../middleware/auth';
import { docClient, TABLES } from '../../utils/dynamodb';
import { badRequest, created, internalError, unauthorized } from '../../utils/response';

interface CreateWishBody {
  dates: string[];
  startTime?: string;
  endTime?: string;
  note?: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const auth = getAuthContext(event);
  if (!auth) return unauthorized();

  if (!event.body) return badRequest('Request body is required');

  let body: CreateWishBody;
  try {
    body = JSON.parse(event.body) as CreateWishBody;
  } catch {
    return badRequest('Invalid JSON');
  }

  if (!body.dates || body.dates.length === 0) {
    return badRequest('dates is required');
  }

  try {
    const item = {
      requestId: uuidv4(),
      userId: auth.userId,
      month: body.dates[0].slice(0, 7),
      preferredDates: body.dates,
      startTime: body.startTime ?? null,
      endTime: body.endTime ?? null,
      note: body.note ?? null,
      submittedAt: new Date().toISOString(),
    };

    await docClient.send(new PutCommand({ TableName: TABLES.SHIFT_REQUESTS, Item: item }));

    return created({ shiftRequest: item });
  } catch (err) {
    console.error('[createWish] error:', err);
    return internalError();
  }
};