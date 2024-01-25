const { InvokeCommand } = require('@aws-sdk/client-lambda')

let _uid = Date.now()


class TestCase {
	static BREAK = 'break'
	static CONTINUE = 'continue'

	static STATUS_SUCCESS = 'success'
	static STATUS_FAIL = 'fail'
	static STATUS_ERROR = 'error'

	/**
	 * TestCase
	 * @constructor
	 * @param {Object}	option
	 * - {String}	service
	 * - {String}	stage
	 * - {String}	region
	 * - {String}	profile
	 * - {Boolean}	serverless
	 * @param {LambdaClient}	lambda
	 * @param {Object} moduleInfo	{ name, version }
	 */
	constructor(option, lambda, moduleInfo) {
		this._option = option
		this._moduleInfo = moduleInfo
		this._lambda = lambda
		this._generator = null

		this.id = Number(++_uid).toString(32)
		this.title = ''
		this.functionName = ''
	}

	/**
	 * Add test case
	 * @param {String} 		functionName 
	 * @param {String} 		title 
	 * @param {Function} 	generator
	 * @returns {TestCase}
	 */
	case (functionName, title, generator) {
		this.title = title
		this.functionName = functionName
		this._generator = generator

		return this
	}

	/**
	 * test case run
	 * @param {Object}	prevCaseResult
	 * @returns {Promise}
	 * 	{
	 * 	  req: { failure, success },
	 * 	  res: { data, raw },
	 *    report: { id, status, title, functionName, requestId, request, response }
	 * 	}
	 */
	async invoke (prevCaseResult) {
		const req = this._makeReq(prevCaseResult)
		let res = {}
		let report = {}

		try {
			const result = await this._lambda.send(new InvokeCommand({
				FunctionName: this._getFunctionName(),
				InvocationType: 'RequestResponse',
				Payload: this._makePayload(req.data)
			}))

			res = this._parseResponse(result, req)
			report = this._getReport(res.fail ? TestCase.STATUS_FAIL : TestCase.STATUS_SUCCESS, res.requestId, req.data, res.raw)
		} catch (err) {
			res.data = err.message
			report = this._getReport(TestCase.STATUS_ERROR, '', req.data, err.message)
		}

		return {
			req: {
				failure: req.failure,
				success: req.success
			},
			res: {
				data: res.data,
				raw: res.raw
			},
			report
		}
	}

	_getFunctionName () {
		return this._option.serverless ? `${this._option.service}-${this._option.stage}-${this.functionName}` : this.functionName
	}

	/**
	 * @returns {Object}	{ fail, data, raw }
	 */
	_parseResponse ({ StatusCode, Payload, $metadata }, req) {
		const result = { fail: false, data: undefined, raw: undefined }
		const resRawData = Payload ? Buffer.from(Payload).toString() : undefined

		if (StatusCode == 200) {
			const resData = this._parseResBody(resRawData)

			result.requestId = $metadata?.requestId
			result.data = resData
			result.raw = resRawData

			if (typeof req.valid === 'function') {
				result.fail = !req.valid(resData, resRawData)
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

	_makeReq (prevCaseResult = {}) {
		const data = typeof this._generator === 'function' ? this._generator(prevCaseResult.data, prevCaseResult.raw) : {}
		const valid = data.valid
		const failure = data.failure || TestCase.CONTINUE
		const success = data.success || TestCase.CONTINUE

		delete data.failure
		delete data.valid

		return {
			data,
			valid,
			failure,
			success
		}
	}

	_makePayload (data) {
		const reqData = JSON.parse(JSON.stringify(data))
		let headers = {
			'User-Agent': `${this._moduleInfo.name}/${this._moduleInfo.version}`
		}

		if (reqData.headers) {
			headers = {
				...headers,
				...reqData.headers
			}

			delete reqData.headers
		}

		return JSON.stringify({
			headers,
			...reqData
		})
	}

	_getReport (status, requestId, request, response) {
		return {
			id: this.id,
			status,
			title: this.title,
			functionName: this.functionName,
			requestId,
			request,
			response
		}
	}
}



module.exports = TestCase