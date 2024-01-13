# aws-lambda-test-case

[![NPM version](https://img.shields.io/npm/v/aws-lambda-test-case.svg)](https://www.npmjs.com/package/aws-lambda-test-case)
[![NPM downloads](https://img.shields.io/npm/dm/aws-lambda-test-case.svg)](https://www.npmjs.com/package/aws-lambda-test-case)

You can register AWS Lambda Functions on a case-by-case basis and easily test them, and also receive a report on the results.
> 🚀Test by invoking the Lambda function deployed on the Dev server.


## Install

Install package as development dependency.

```bash
npm i aws-lambda-test-case --save-dev
```

&nbsp;

## Quick start
```js
const { AWSLambdaTestCase } = require('aws-lambda-test-case')

const test = new AWSLambdaTestCase({ service: 'my-repository' })


/**
 * Add test case
 */
test.case('lambdaFunctionName1', 'log title1', (prevRes) => ({
  queryStringParameters: {
    storeId: 1
  },
  failure: AWSLambdaTestCase.BREAK
}))

test.case('lambdaFunctionName2', 'log title2', (prevRes) => ({
  body: {
    productId: prevRes.body.productId
  },
  failure: AWSLambdaTestCase.BREAK
}))

//Test case batch run
test.run()
```

### Console Result
```
########## AWSLambdaTestCase - Start (total: 2)

1) ===== log title1 =====
 - Status: ✅SUCCESS
 - Function: lambdaFunctionName1
 - RequestId: 609766-c26b-4d86-9493-63a56789d
 { statusCode: 200, body: { result: 'test' } } 
 
2) ===== log title2 =====
 - Status: 🚫FAIL
 - Function: lambdaFunctionName2
 { statusCode: 400, body: { message: 'error!' } } 
 
########## AWSLambdaTestCase - Finished (success: 1, failure: 1)
```

&nbsp;

## AWSLambdaTestCase

### constructor

> All options are optional.  
> - If you set `serverless = true`, you configure Lambda FunctionName with `<service>-<stage>-<functionName>`.   
> - To specify a separate `~/.aws/credentials` profile alias other than `[default]`, you must set `profile`.

| Param | Type | Description |
| --- | --- | --- |
| option | *Object* | @param *{String}* `service`	repository name<br>@param *{String}* `stage`	default: 'dev'<br>@param *{String}* `region`	default: 'ap-northeast-2'<br>@param *{String}* `profile`	default: 'default'<br>@param *{Boolean}* `serverless`	default: true |

```js
const test = new AWSLambdaTestCase({
  service: 'my-repository',
  profile: 'my-profile'
})
```

&nbsp;

### case(functionName, title, generator) : *{AWSLambdaTestCase}*
>  Add test case

| Param | Type | Description |
| --- | --- | --- |
| functionName | *String* | Lambda function name |
| title | *String* | log title |
| generator | *Function* | @returns *{Object}* { failure, success, valid, queryStringParameters, body, pathParameters ... } |

```js
const test = new AWSLambdaTestCase({
  service: 'my-repository'
})

/**
 * "generator" function dynamically returns Lambda event + request option.
 * @param {Object}  prevRes     Response from previous test case
 * @param {Object}  prevRawRes  Raw response from previous test case
 * @returns {Object}
 * - {Function} valid		Dynamically determines status, if it returns true, it is treated as success (Optional)
 * - {Enum}	failure		  Set whether to continue after a result fails (default: AWSLambdaTestCase.CONTINUE)
 * - {Enum}	success		  Set whether to continue after a successful result (defalut: AWSLambdaTestCase.CONTINUE)
*/
test.case('myFunctionName', 'log title', (prevRes, prevRawRes) => ({
  /** --- Lambda event --- */
  queryStringParameters: {
    storeId: 1
  },
  body: {
    productId: 10
  },

  /** --- Request options --- */
  /**
   * valid function dynamically determines the status.
   * @param {Object}  res   Lambda response result
   * @returns {Boolean} 
  */
  valid: (res) => res.body.result === 'test',
  success: AWSLambdaTestCase.CONTINUE,
  failure: AWSLambdaTestCase.BREAK
}))
```

&nbsp;

### run() : *{Promise}*
> Test case batch run   
> Returns console log and report data

#### Report data
```json
{
  "total": 2,
  "success": 1,
  "failure": 1,
  "report": [
    {
      "key": 1,
      "status": "success",
      "title": "log title1",
      "functionName": "lambdaFunctionName1",
      "requestId": "609766-c26b-4d86-9493-63a56789d",
      "request": {
        "queryStringParameters": {
          "storeId": 1
        }
      },
      "response": "{\"headers\":{\"Access-Control-Allow-Origin\":\"*\"},\"statusCode\":200,\"body\":\"{\"result\":\"test\"}\"}"
    },
    {
      "key": 2,
      "status": "success",
      "title": "log title2",
      "functionName": "lambdaFunctionName2",
      "requestId": "",
      "request": {
        "body": {
          "productId": 2
        }
      },
      "response": "{\"headers\":{\"Access-Control-Allow-Origin\":\"*\"},\"statusCode\":400,\"body\":\"{\"message\":\"error!\"}\"}"
    }
  ]
}
```
 
&nbsp;

## Example
You can set the request for the next case based on the response from the previous case.

```js
const { AWSLambdaTestCase } = require('aws-lambda-test-case')
const test = new AWSLambdaTestCase({ service: 'my-repository' })


test.case('lambdaFunctionName1', 'log title1', (prevRes) => ({
  queryStringParameters: {
    storeId: 1
  },
  failure: AWSLambdaTestCase.BREAK
}))

test.case('lambdaFunctionName2', 'log title2', (prevRes) => ({
  body: {
    productId: prevRes.body.productId
  },
  valid: (res) => res.body.list.length > 0,
  failure: AWSLambdaTestCase.BREAK
}))

//Test case batch run
test.run()
```


&nbsp;

## ⚠️ Caution

To use AWS Lambda, you need to set up an IAM policy.   
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeFunction"
      ],
      "Resource": [
        "arn:aws:lambda:<region>:<accountId>:function:*"
      ]
    }
  ]
}
```