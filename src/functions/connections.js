const AWS = require("aws-sdk");
const ddb = new AWS.DynamoDB.DocumentClient({
  apiVersion: "2012-08-10",
  region: process.env.AWS_REGION,
});

const { TableName } = { TableName: "ChatConnections" };

exports.connect = async (event) => {
  const { connectionId } = event.requestContext;
  const { name } = JSON.parse(event.body);
  const putParams = {
    TableName,
    Item: {
      connectionId: connectionId,
      name: name,
    },
  };

  try {
    await ddb.put(putParams).promise();
    return { statusCode: 200, body: "Connected." };
  } catch (err) {
    return {
      statusCode: 500,
      body: "Failed to connect: " + JSON.stringify(err),
    };
  }
};

exports.disconnect = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const deleteParams = {
    TableName,
    Key: {
      connectionId: connectionId,
    },
  };

  try {
    await ddb.delete(deleteParams).promise();
    return { statusCode: 200, body: "Disconnected." };
  } catch (err) {
    return {
      statusCode: 500,
      body: "Failed to disconnect: " + JSON.stringify(err),
    };
  }
};
