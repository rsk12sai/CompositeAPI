const express = require("express");

const { getSalesforceToken } = require("./auth");

const {
  executeComposite,
  createLog,
  createCase
} = require("./composite");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;


/**
 * Main Salesforce Integration Flow
 *
 * Flow:
 *
 * 1. Authenticate with Salesforce
 * 2. Execute Composite GET requests
 * 3. Check technical GET failures
 * 4. Check missing records
 * 5. Create Log__c if validation fails
 * 6. Skip Case creation on failure
 * 7. Create Case when all required records exist
 */
async function main() {

  try {

    console.log("Authenticating with Salesforce...");

    const {
      accessToken,
      instanceUrl
    } = await getSalesforceToken();

    console.log("Authentication successful");

    console.log("\nExecuting GET Composite API...");

    const result = await executeComposite(
      instanceUrl,
      accessToken
    );

    const responses = result.compositeResponse;


    /**
     * Technical GET Failure Validation
     *
     * Any HTTP status outside 2xx
     * is considered a technical failure.
     */
    const failedRequests = responses.filter(
      item =>
        item.httpStatusCode < 200 ||
        item.httpStatusCode >= 300
    );


    if (failedRequests.length > 0) {

      console.log("\nGET failure detected");

      for (const failed of failedRequests) {

        const errorBody = Array.isArray(failed.body)
          ? failed.body[0]
          : failed.body;


        const logData = {

          API_Name__c:
            "Composite Search API",

          Request_Method__c:
            "GET",

          Request_URI__c:
            failed.referenceId,

          Status_Code__c:
            failed.httpStatusCode,

          Error_Code__c:
            errorBody?.errorCode ||
            "UNKNOWN_ERROR",

          Error_Message__c:
            errorBody?.message ||
            JSON.stringify(failed.body),

          Reference_Id__c:
            failed.referenceId,

          Transaction_Id__c:
            failed.referenceId,

          Type__c:
            "Failure"
        };


        /**
         * Create Log__c for failed GET request.
         */
        const logResult = await createLog(
          instanceUrl,
          accessToken,
          logData
        );


        console.log(
          `Log created for ${failed.referenceId}: ${logResult.id}`
        );
      }


      console.log("Case creation skipped.");

      return {
        success: false,
        caseCreated: false,
        message: "GET request failed"
      };
    }


    /**
     * Find each Composite response
     * using the referenceId.
     */
    const accountResponse = responses.find(
      r => r.referenceId === "accountQuery"
    );

    const contactResponse = responses.find(
      r => r.referenceId === "contactQuery"
    );

    const opportunityResponse = responses.find(
      r => r.referenceId === "opportunityQuery"
    );


    /**
     * Business Validation
     *
     * Salesforce can return HTTP 200
     * with:
     *
     * totalSize = 0
     *
     * This means the query succeeded technically,
     * but the expected record was not found.
     */
    const missingRecords = [];


    if (accountResponse.body.totalSize === 0) {
      missingRecords.push("Account");
    }


    if (contactResponse.body.totalSize === 0) {
      missingRecords.push("Contact");
    }


    if (opportunityResponse.body.totalSize === 0) {
      missingRecords.push("Opportunity");
    }


    /**
     * Required Record Not Found
     *
     * Create Log__c and stop Case creation.
     */
    if (missingRecords.length > 0) {

      const message =
        `Record not found: ${missingRecords.join(", ")}`;

      console.log(message);


      const logResult = await createLog(
        instanceUrl,
        accessToken,
        {

          API_Name__c:
            "Composite Search API",

          Request_Method__c:
            "GET",

          Request_URI__c:
            "Composite Search",

          Status_Code__c:
            200,

          Error_Code__c:
            "RECORD_NOT_FOUND",

          Error_Message__c:
            message,

          Reference_Id__c:
            "recordValidation",

          Transaction_Id__c:
            "recordValidation",

          Type__c:
            "Failure"
        }
      );


      console.log(
        "Log created:",
        logResult.id
      );


      console.log(
        "Case creation skipped."
      );


      return {
        success: false,
        caseCreated: false,
        message,
        logId: logResult.id
      };
    }


    /**
     * All GET Requests Successful
     *
     * Extract the Salesforce records.
     */
    const account =
      accountResponse.body.records[0];

    const contact =
      contactResponse.body.records[0];

    const opportunity =
      opportunityResponse.body.records[0];


    console.log("\nAll required records found");


    console.log(
      "Account:",
      account.Name
    );


    console.log(
      "Contact:",
      `${contact.FirstName} ${contact.LastName}`
    );


    console.log(
      "Opportunity:",
      opportunity.Name
    );


    /**
     * Create Case
     *
     * Executed only when:
     *
     * - All GET requests succeeded
     * - Account exists
     * - Contact exists
     * - Opportunity exists
     */
    const caseResult = await createCase(
      instanceUrl,
      accessToken,
      account.Id,
      contact.Id
    );


    console.log(
      "\nCase created successfully"
    );


    console.log(
      "Case Id:",
      caseResult.id
    );


    return {
      success: true,
      caseCreated: true,
      caseId: caseResult.id
    };


  } catch (error) {

    /**
     * Unexpected Failure Handler
     */
    console.error(
      "\nUnexpected failure"
    );


    if (error.response) {

      console.error(
        JSON.stringify(
          error.response.data,
          null,
          2
        )
      );


      return {
        success: false,
        caseCreated: false,
        error: error.response.data
      };
    }


    console.error(
      error.message
    );


    return {
      success: false,
      caseCreated: false,
      error: error.message
    };
  }
}


/**
 * Health Check Endpoint
 *
 * Used by Render to verify
 * that the Node.js service is running.
 */
app.get("/", (req, res) => {

  res.status(200).send(
    "Salesforce Composite API service is running"
  );

});


/**
 * Salesforce Composite API Endpoint
 *
 * Triggers the existing main integration flow.
 */
app.post(
  "/api/composite",
  async (req, res) => {

    const result = await main();


    if (result.success) {

      return res.status(201).json(result);

    }


    if (
      result.message &&
      result.message.startsWith("Record not found")
    ) {

      return res.status(404).json(result);

    }


    return res.status(422).json(result);
  }
);


/**
 * Start Node.js Server
 *
 * Render automatically provides PORT.
 * Local development uses port 3000.
 */
app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `Server running on port ${PORT}`
    );

  }
);