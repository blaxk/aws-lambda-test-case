# aws-lambda-test-case

[![NPM version](https://img.shields.io/npm/v/aws-lambda-test-case.svg)](https://www.npmjs.com/package/aws-lambda-test-case)
[![NPM downloads](https://img.shields.io/npm/dm/aws-lambda-test-case.svg)](https://www.npmjs.com/package/aws-lambda-test-case)

AWS Lambda Function을 케이스별도 등록하고 간편하게 테스트할 수 있으며, 결과 Report도 반환 받을 수 있습니다.


## Install

Install package as development dependency.

```bash
npm i aws-lambda-test-case --save-dev
```

&nbsp;

## Quick start
```js
const { AWSLambdaTestCase } = require('aws-lambda-test-case')

//저장소별 테스트 케이스 생성
const test = new AWSLambdaTestCase({ service: 'my-repository' })


/**
 * Test case 등록
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

//Test 일괄 실행
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

> 옵션은 모두 선택사항 입니다.  
> - `serverless=true`를 설정하면, `{service}-{stage}-{functionName}` 으로 Lambda FunctionName을 구성합니다.   
> - To specify a separate `~/.aws/credentials` profile alias other than `[default]`, `profile` 을 설정합니다.

| Param | Type | Description |
| --- | --- | --- |
| option | *Object* | @param *{String}* `service`	repository name<br>@param *{String}* `stage`	default: 'dev'<br>@param *{String}* `region`	default: 'ap-northeast-2'<br>@param *{String}* `profile`	default: 'default'<br>@param *{Boolean}* `serverless`	default: true |

```js
const test = new AWSLambdaTestCase({
  service: 'my-repository',
  profile: 'my-dev-profile'
})
```

### case(functionName, title, handler) : *{AWSLambdaTestCase}*
> Test case를 추가합니다.

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
 * generator function은 동적으로 Lambda의 이벤트 객체 + request option을 반환합니다.
 * @param {Object}  prevRes 이전 test case의 반환값
 * @param {Object}  prevRawRes 이전 test case의 원본 반환값
 * @returns {Object}
 *  - {Function} valid		최종상태를 결정하는 함수, true를 반환하면 success로 처리됨 (선택)
 * - {Enum}	failure		결과 실패 이후 계속진행할지 여부 설정 (default: AWSLambdaTestCase.CONTINUE)
 * - {Enum}	success		결과 성공 이후 계속진행할지 여부 설정 (defalut: AWSLambdaTestCase.CONTINUE)
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
   * valid는 동적으로 최종상태를 결정
   * @param {Object}  res   Lambda response result
   * @returns {Boolean} 
  */
  valid: (res) => res.body.result === 'test',
  success: AWSLambdaTestCase.CONTINUE,
  failure: AWSLambdaTestCase.BREAK
}))
```

### run() : *{Promise}*
> Test 실행   
> Console log 및 report data를 반환

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

//Test 일괄 실행
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
      "Resource": "*"
    }
  ]
}
```