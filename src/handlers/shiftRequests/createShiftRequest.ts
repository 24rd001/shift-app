import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { getAuthContext } from '../../middleware/auth';
import { docClient, TABLES } from '../../utils/dynamodb';
import { badRequest, created, internalError, unauthorized } from '../../utils/response';

interface CreateShiftRequestBody {
  month: string;            // "2025-06"
  preferredDates: string[]; // ["2025-06-01", "2025-06-03"]
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const auth = getAuthContext(event);
  if (!auth) return unauthorized();

  if (!event.body) return badRequest('Request body is required');

  let body: CreateShiftRequestBody;
  try {
    body = JSON.parse(event.body) as CreateShiftRequestBody;
  } catch {
    return badRequest('Invalid JSON');
  }

  const { month, preferredDates } = body;

  if (!month || !preferredDates) {
    return badRequest('month and preferredDates are required');
  }
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return badRequest('month must be in YYYY-MM format');
  }
  if (!Array.isArray(preferredDates) || preferredDates.length === 0) {
    return badRequest('preferredDates must be a non-empty array');
  }

  try {
    const item = {
      requestId: uuidv4(),
      userId: auth.userId,
      month,
      preferredDates,
      submittedAt: new Date().toISOString(),
    };

    await docClient.send(new PutCommand({ TableName: TABLES.SHIFT_REQUESTS, Item: item }));

    return created({ shiftRequest: item });
  } catch (err) {
    console.error('[createShiftRequest] error:', err);
    return internalError();
  }
};
