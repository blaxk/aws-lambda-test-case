const { LambdaClient } = require('@aws-sdk/client-lambda')
const { fromIni } = require('@aws-sdk/credential-provider-ini')
const TestCase = require('./TestCase')

const MODULE_NAME = 'AWSLambdaTestCase'
const MODULE_VER = '0.7.0'


class AWSLambdaTestCase {
	// The next case is not executed after the result.
	static BREAK = TestCase.BREAK
	// After the result, execute the next case.
	static CONTINUE = TestCase.CONTINUE

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
		this._option = {
			service: option.service,
			stage: option.stage || 'dev',
			region: option.region || 'ap-northeast-2',
			profile: option.profile || 'default',
			serverless: option.serverless === false ? option.serverless : true
		}

		this._lambda = new LambdaClient({
			region: this._option.region,
			credentials: fromIni({ profile: this._option.profile })
		})

		this._cases = []
	}

	/** ========== Public Methods ========== */

	/**
	 * Add test case
	 * @param {String} 		functionName 
	 * @param {String} 		title 
	 * @param {Function} 	generator		return { failure, success, valid, queryStringParameters, body, pathParameters ... }
	 * - {Function} valid		Dynamically determines status, if it returns true, it is treated as success (Optional)
	 * - {Enum} 	failure		Set whether to continue after a result fails (AWSLambdaTestCase.BREAK | AWSLambdaTestCase.CONTINUE)
	 * - {Enum} 	success		Set whether to continue after a successful result (AWSLambdaTestCase.BREAK | AWSLambdaTestCase.CONTINUE)
	 * @returns {TestCase}
	 */
	case (functionName, title, generator) {
		const testCase = new TestCase(this._option, this._lambda, { name: MODULE_NAME, version: MODULE_VER })
			.case(functionName, title, generator)

		this._cases.push(testCase)
		return testCase
	}

	/**
	 * test case run
	 * @param	{Array}		targetCases  If you specify a TestCase in the "targetCases" array, only that TestCase will be run. (Optional)
	 * @returns {Promise}	{ total, success, failure, report: [{ id, status, title, functionName, requestId, request, response }] }
	 */
	async run (targetCases) {
		const cases = targetCases?.length ? targetCases.filter((targetCase) => {
				return this._cases.findIndex((origin) => origin.id === targetCase.id) > -1
			}) : this._cases

		return await this._batch(cases)
	}

	/** ========== Private Methods ========== */

	/**
	 * batch
	 * @param {Array}	cases 	target cases
	 * @returns {Promise} { total, success, failure, report }
	 */
	async _batch (cases) {
		const total = cases.length
		const reports = []
		let success = 0
		let failure = 0
		let i = 0
		let prevCaseResult = {}

		console.log(`########## ${MODULE_NAME} - Start (total: ${total})\n`)

		for (i = 1; i <= total; ++i) {
			const testCase = cases[i - 1]
			const { req, res, report } = await testCase.invoke(prevCaseResult)

			prevCaseResult = res
			reports.push(report)
			this._log(i, report, res.data)

			if (report.status === TestCase.STATUS_SUCCESS) {
				success++
				if (req.success === TestCase.BREAK) break
			} else {
				failure++
				if (req.failure === TestCase.BREAK) break
			}
		}

		console.log(`########## ${MODULE_NAME} - Finished (success: ${success}, failure: ${failure})\n`)

		return {
			total,
			success,
			failure,
			reports
		}
	}

	_log (idx, { id, status, title, functionName, requestId }, resData) {
		let emoji = '✅'

		if (status === TestCase.STATUS_ERROR) {
			emoji = '🚫'
		} else if (status === TestCase.STATUS_FAIL) {
			emoji = '🚨'
		}

		console.log(`${idx}) ===== ${title} ===== ${id}\n - Status: ${emoji}${status.toUpperCase()}\n - Function: ${functionName}${requestId ? `\n - RequestId: ${requestId}` : ''}\n`, resData, '\n ')
	}
}



module.exports = AWSLambdaTestCase