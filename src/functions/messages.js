const AWS = require("aws-sdk");
const ddb = new AWS.DynamoDB.DocumentClient({
  apiVersion: "2012-08-10",
  region: process.env.AWS_REGION,
});
const { ApiGatewayManagementApi } = require("aws-sdk");

exports.sendMessage = async (event) => {
  console.log("event log example:", JSON.stringify(event, null, 2));
  const postData = JSON.parse(event.body).data;
  console.log("postData log example:", JSON.stringify(postData, null, 2));
  const connectionId = event.requestContext.connectionId;
  console.log("connectionId log example:", JSON.stringify(connectionId, null, 2));
  const timestamp = new Date().getTime();
  console.log("timestamp log example:", JSON.stringify(timestamp, null, 2));

  try {
    await ddb
      .put({
        TableName: "ChatMessages",
        Item: { connectionId, timestamp, message: postData, senderName }, // Include senderName
      })
      .promise();
  } catch (err) {
    console.log("err log example:", JSON.stringify(err, null, 2));
    return {
      statusCode: 500,
      body: "Failed to save message: " + JSON.stringify(err),
    };
  }

  let connectionData, senderName;
  try {
    connectionData = await ddb.scan({ TableName: "ChatConnections" }).promise();
    senderName = connectionData.Items.find((item) => item.connectionId === connectionId).name;
    console.log("connectionData log example:", JSON.stringify(connectionData, null, 2));
  } catch (err) {
    console.log("err log example:", JSON.stringify(err, null, 2));
    return {
      statusCode: 500,
      body: "Failed to retrieve connections: " + JSON.stringify(err),
    };
  }

  const endpoint = `${event.requestContext.domainName}/${event.requestContext.stage}`;
  console.log("endpoint log example:", JSON.stringify(endpoint, null, 2));
  const apiGateway = new ApiGatewayManagementApi({
    apiVersion: "2018-11-29",
    endpoint,
  });
  console.log("apiGateway log example:", JSON.stringify(apiGateway, null, 2));

  const postCalls = connectionData.Items.map(async ({ connectionId }) => {
    console.log("connectionId log example:", JSON.stringify(connectionId, null, 2));
    try {
      await apiGateway.postToConnection({ ConnectionId: connectionId, Data: postData }).promise();
    } catch (err) {
      console.log("err log example:", JSON.stringify(err, null, 2));
      if (err.statusCode === 410) {
        console.log(`Found stale connection, deleting ${connectionId}`);
        await ddb.delete({ TableName: "ChatConnections", Key: { connectionId } }).promise();
      } else {
        console.error("Error posting to connection", err);
        throw err;
      }
    }
  });

  try {
    await Promise.all(postCalls);
    return { statusCode: 200, body: "Message sent." };
  } catch (err) {
    console.log("err log example:", JSON.stringify(err, null, 2));
    return {
      statusCode: 500,
      body: "Failed to send messages: " + JSON.stringify(err),
    };
  }
};

exports.deleteAllCommonMessages = async (event) => {
  try {
    const messages = await ddb.scan({ TableName: "ChatMessages" }).promise();

    if (messages.Items.length === 0) {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "OPTIONS, DELETE",
          "Access-Control-Allow-Credentials": true,
        },
        body: "No messages to delete.",
      };
    }

    const deleteRequests = messages.Items.map((message) => ({
      DeleteRequest: {
        Key: {
          connectionId: message.connectionId,
          timestamp: message.timestamp,
        },
      },
    }));

    const MAX_BATCH_SIZE = 25;
    for (let i = 0; i < deleteRequests.length; i += MAX_BATCH_SIZE) {
      const batch = deleteRequests.slice(i, i + MAX_BATCH_SIZE);
      await ddb
        .batchWrite({
          RequestItems: {
            ChatMessages: batch,
          },
        })
        .promise();
    }

    console.log("All messages deleted successfully.");

    return {
      statusCode: 200,
      body: "All messages deleted.",
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, DELETE",
        "Access-Control-Allow-Credentials": true,
      },
    };
  } catch (error) {
    console.error("Failed to delete messages:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, DELETE",
        "Access-Control-Allow-Credentials": true,
      },
      body: "Failed to delete messages: " + JSON.stringify(error),
    };
  }
};
