const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda')
const { fromIni } = require('@aws-sdk/credential-provider-ini')

const MODULE_NAME = 'AWSLambdaTestCase'
const MODULE_VER = '0.5.1'


class AWSLambdaTestCase {
	// The next case is not executed after the result.
	static BREAK = 'break'
	// After the result, execute the next case.
	static CONTINUE = 'continue'

	static STATUS_SUCCESS = 'success'
	static STATUS_FAIL = 'fail'
	static STATUS_ERROR = 'error'

	/**
	 * AWSLambdaTestCase
	 * @constructor
	 * @param {Object}	option
	 * - {String}	service		repository name
	 * - {String}	stage		default: 'dev'
	 * - {String}	region		default: 'ap-northeast-2'
	 * - {String}	profile		default: 'default'
	 * - {Boolean}	serverless	default: true
	 */
	constructor(option = {}) {
		this.service = option.service
		this.stage = option.stage || 'dev'
		this.region = option.region || 'ap-northeast-2'
		this.profile = option.profile || 'default'
		this.serverless = option.serverless === false ? option.serverless : true
		this.cases = []
		this.report = []
		this._caseKey = 0
	}

	/**
	 * Add test case
	 * @param {String} 		functionName 
	 * @param {String} 		title 
	 * @param {Function} 	generator		return { failure, success, valid, queryStringParameters, body, pathParameters ... }
	 * - {Function} valid		Dynamically determines status, if it returns true, it is treated as success (Optional)
	 * - {Enum} 	failure		Set whether to continue after a result fails (AWSLambdaTestCase.BREAK | AWSLambdaTestCase.CONTINUE)
	 * - {Enum} 	success		Set whether to continue after a successful result (AWSLambdaTestCase.BREAK | AWSLambdaTestCase.CONTINUE)
	 */
	case (functionName, title, generator) {
		const prevCase = this._getPrevCase()
		
		this.cases.push({
			key: ++this._caseKey,
			functionName,
			title,
			data: {},
			// valid,
			// failure,
			// success,
			res: undefined,
			rawRes: undefined,

			generator,
			prevCase
		})

		return this
	}

	/**
	 * test case run
	 * @returns {Promise}	{ total, success, failure, report: [{ key, status, title, functionName, requestId, request, response }] }
	 */
	async run () {
		const total = this.cases.length
		let success = 0
		let failure = 0
		let i = 0

		const client = new LambdaClient({
			region: this.region,
			credentials: fromIni({ profile: this.profile })
		})

		console.log(`########## ${MODULE_NAME} - Start (total: ${total})\n`)

		for (i = 1; i <= total; ++i) {
			const testCase = this.cases[i - 1]
			this._remakeCase(testCase)

			try {
				const result = await client.send(new InvokeCommand({
					FunctionName: this._getFunctionName(testCase),
					InvocationType: 'RequestResponse',
					Payload: this._getPayload(testCase)
				}))

				const res = this._parseResponse(testCase, result)
				this._addReport(res.fail ? AWSLambdaTestCase.STATUS_FAIL : AWSLambdaTestCase.STATUS_SUCCESS, testCase, res.requestId, res.raw)

				if (res.fail) {
					failure++
					this._log(AWSLambdaTestCase.STATUS_FAIL, testCase, res)
					if (testCase.failure === AWSLambdaTestCase.BREAK) break
				} else {
					success++
					testCase.res = res.data
					testCase.rawRes = res.raw
					this._log(AWSLambdaTestCase.STATUS_SUCCESS, testCase, res)
					if (testCase.success === AWSLambdaTestCase.BREAK) break
				}
			} catch (err) {
				failure++
				this._addReport(AWSLambdaTestCase.STATUS_ERROR, testCase, '', err.message)
				this._log(AWSLambdaTestCase.STATUS_ERROR, testCase, err.message)
				if (testCase.failure === AWSLambdaTestCase.BREAK) break
			}
		}

		console.log(`########## ${MODULE_NAME} - Finished (success: ${success}, failure: ${failure})\n`)

		return {
			total,
			success,
			failure,
			report: this.report
		}
	}

	_remakeCase (testCase) {
		const prevCase = testCase.prevCase || {}
		const data = typeof testCase.generator === 'function' ? testCase.generator(prevCase.res, prevCase.rawRes) : {}
		const valid = data.valid
		const failure = data.failure || AWSLambdaTestCase.CONTINUE
		const success = data.success || AWSLambdaTestCase.CONTINUE

		delete data.failure
		delete data.valid
		delete testCase.generator
		delete testCase.prevCase

		testCase.data = data
		testCase.valid = valid
		testCase.failure = failure
		testCase.success = success
	}

	_getPrevCase () {
		return this.cases.length > 0 ? this.cases[this.cases.length - 1] : {}
	}

	_getFunctionName (testCase) {
		return this.serverless ? `${this.service}-${this.stage}-${testCase.functionName}` : testCase.functionName
	}

	/**
	 * @returns {Object}	{ fail, data, raw }
	 */
	_parseResponse (testCase, { StatusCode, Payload, $metadata }) {
		const result = { fail: false, data: undefined, raw: undefined }
		const resRawData = Payload ? Buffer.from(Payload).toString() : undefined
		
		if (StatusCode == 200) {
			const resData = this._parseResBody(resRawData)

			result.requestId = $metadata?.requestId
			result.data = resData
			result.raw = resRawData

			if (typeof testCase.valid === 'function') {
				result.fail = !testCase.valid(resData, resRawData)
			} else if (resData.statusCode && resData.statusCode != 200) {
				result.fail = true
			}
		} else {
			result.fail = true
		}

		return result
	}

	_parseResBody (resPayload) {
		let result = resPayload

		if (typeof resPayload === 'string' && (/^\{[\w\W]*\}$/.test(resPayload) || /^\[[\w\W]*\]$/.test(resPayload))) {
			try {
				result = JSON.parse(resPayload)
				delete result.headers

				if (result.body) {
					result.body = this._parseResBody(result.body)
				}
			} catch (err) {
				console.error(err)
			}
		}

		return result
	}

	_getPayload (testCase = {}) {
		let headers = {
			'User-Agent': `${MODULE_NAME}/${MODULE_VER}`
		}

		if (testCase.headers) {
			headers = {
				...headers,
				...testCase.headers
			}
		}

		return JSON.stringify({
			headers,
			...testCase.data
		})
	}

	_addReport (status, testCase, requestId, response) {
		this.report.push({
			key: testCase.key,
			status,
			title: testCase.title,
			functionName: testCase.functionName,
			requestId,
			request: testCase.data,
			response
		})
	}

	_log (status, testCase, res) {
		let emoji = '✅'

		if (status === AWSLambdaTestCase.STATUS_ERROR) {
			emoji = '🚫'
		} else if (status === AWSLambdaTestCase.STATUS_FAIL) {
			emoji = '🚨'
		}

		console.log(`${testCase.key}) ===== ${testCase.title} =====\n - Status: ${emoji}${status.toUpperCase()}\n - Function: ${testCase.functionName}${res?.requestId ? `\n - RequestId: ${res.requestId}` : ''}\n`, typeof res === 'object' ? res.data : res, '\n ')
	}
}



module.exports = AWSLambdaTestCase