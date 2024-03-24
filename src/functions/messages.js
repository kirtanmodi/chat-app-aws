const AWS = require("aws-sdk");
console.log("AWS log example:", JSON.stringify(AWS, null, 2));
const ddb = new AWS.DynamoDB.DocumentClient({
  apiVersion: "2012-08-10",
  region: process.env.AWS_REGION,
});
console.log("ddb log example:", JSON.stringify(ddb, null, 2));
const { ApiGatewayManagementApi } = require("aws-sdk");

exports.sendMessage = async (event) => {
  console.log("event log example:", JSON.stringify(event, null, 2));
  const postData = JSON.parse(event.body).data;
  console.log("postData log example:", JSON.stringify(postData, null, 2));
  const connectionId = event.requestContext.connectionId;
  console.log(
    "connectionId log example:",
    JSON.stringify(connectionId, null, 2)
  );
  const timestamp = new Date().getTime();
  console.log("timestamp log example:", JSON.stringify(timestamp, null, 2));

  try {
    await ddb
      .put({
        TableName: "ChatMessages",
        Item: { connectionId, timestamp, message: postData },
      })
      .promise();
  } catch (err) {
    console.log("err log example:", JSON.stringify(err, null, 2));
    return {
      statusCode: 500,
      body: "Failed to save message: " + JSON.stringify(err),
    };
  }

  let connectionData;
  try {
    connectionData = await ddb.scan({ TableName: "ChatConnections" }).promise();
    console.log(
      "connectionData log example:",
      JSON.stringify(connectionData, null, 2)
    );
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
    console.log(
      "connectionId log example:",
      JSON.stringify(connectionId, null, 2)
    );
    try {
      await apiGateway
        .postToConnection({ ConnectionId: connectionId, Data: postData })
        .promise();
    } catch (err) {
      console.log("err log example:", JSON.stringify(err, null, 2));
      if (err.statusCode === 410) {
        console.log(`Found stale connection, deleting ${connectionId}`);
        await ddb
          .delete({ TableName: "ChatConnections", Key: { connectionId } })
          .promise();
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
