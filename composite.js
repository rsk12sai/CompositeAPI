const axios = require("axios");

const API_VERSION = "v66.0";

function buildQueryUrl(soql) {
  return `/services/data/${API_VERSION}/query/?q=${encodeURIComponent(soql)}`;
}

async function executeComposite(instanceUrl, accessToken) {
  const accountSoql = `
    SELECT Id, Name, AccountNumber, Phone
    FROM Account
    WHERE Name = 'TEST DOES NOT EXIST'
    LIMIT 1
  `;

  const contactSoql = `
    SELECT Id, FirstName, LastName, Email, AccountId
    FROM Contact
    WHERE Account.Name = 'Edge Communications'
    LIMIT 1
  `;

  const opportunitySoql = `
    SELECT Id, Name, AccountId, StageName, CloseDate
    FROM Opportunity
    WHERE Account.Name = 'Edge Communications'
    LIMIT 1
  `;

  const compositeRequest = {
    allOrNone: false,
    compositeRequest: [
      {
        method: "GET",
        url: buildQueryUrl(accountSoql),
        referenceId: "accountQuery"
      },
      {
        method: "GET",
        url: buildQueryUrl(contactSoql),
        referenceId: "contactQuery"
      },
      {
        method: "GET",
        url: buildQueryUrl(opportunitySoql),
        referenceId: "opportunityQuery"
      }
    ]
  };

  const response = await axios.post(
    `${instanceUrl}/services/data/${API_VERSION}/composite`,
    compositeRequest,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data;
}

async function createLog(instanceUrl, accessToken, logData) {
  const response = await axios.post(
    `${instanceUrl}/services/data/${API_VERSION}/sobjects/Log__c`,
    logData,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data;
}

async function createCase(instanceUrl, accessToken, accountId, contactId) {
  const response = await axios.post(
    `${instanceUrl}/services/data/${API_VERSION}/sobjects/Case`,
    {
      Subject: "Case created from Node.js",
      Description: "Created after successful GET validations",
      Origin: "Web",
      Status: "New",
      AccountId: accountId,
      ContactId: contactId
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data;
}

module.exports = {
  executeComposite,
  createLog,
  createCase
};