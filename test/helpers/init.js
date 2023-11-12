const path = require('path')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')

process.env.TS_NODE_PROJECT = path.resolve('test/tsconfig.json')
process.env.NODE_ENV = 'development'

// Localstack Config
process.env.AWS_REGION = 'us-east-1'
process.env.AWS_ACCESS_KEY_ID = 'abc'
process.env.AWS_SECRET_ACCESS_KEY = '123'

global.oclif = global.oclif || {}
global.oclif.columns = 80

chai.use(chaiAsPromised)