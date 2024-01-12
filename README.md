# aws-lambda-test-case

[![NPM version](https://img.shields.io/npm/v/aws-lambda-test-case.svg)](https://www.npmjs.com/package/aws-lambda-test-case)
[![NPM downloads](https://img.shields.io/npm/dm/aws-lambda-test-case.svg)](https://www.npmjs.com/package/aws-lambda-test-case)

AWS Lambda 의 테스트 케이스를 등록하고 간편하게 Lambda Function을 테스트할 수 있습니다.


## Install

Install package as development dependency.

```bash
npm i aws-lambda-test-case --save-dev
```

&nbsp;

## Quick start
```js
const TestCase = require('aws-lambda-test-case')
const test = new TestCase({ service: 'my-repository' })


/**
 * Test case 등록
 */
test.case('lambdaFunctionName1', 'log title1', (prevRes) => ({
	queryStringParameters: {
		storeId: 1
	},
	failure: TestCase.BREAK
}))

test.case('lambdaFunctionName2', 'log title2', (prevRes) => ({
	body: {
		productId: prevRes.body.productId
	},
	failure: TestCase.BREAK
}))

//등록된 Test case 샐행
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


### Report
```
{
  total: 2,
  success: 1,
  failure: 1,
  report: [
    {
      key: 1,
      status: 'success',
      title: 'log title1',
      functionName: 'lambdaFunctionName1',
      requestId: '609766-c26b-4d86-9493-63a56789d',
      request: {
        queryStringParameters: {
		      storeId: 1
	      }
      },
      response: '{"headers":{"Access-Control-Allow-Origin":"*"},"statusCode":200,"body":"{\\"result\\":\\"test\\"}"}'
    },
    {
      key: 2,
      status: 'fail',
      title: 'log title2',
      functionName: 'lambdaFunctionName2',
      requestId: '',
      request: {
        body: {
		      productId: 2
	      }
      },
      response: '{"headers":{"Access-Control-Allow-Origin":"*"},"statusCode":400,"body":"{\\"message\\":\\"error!\\"}"}'
    }
  ]
}
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