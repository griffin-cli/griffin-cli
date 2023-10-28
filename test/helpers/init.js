const path = require('path')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')

process.env.TS_NODE_PROJECT = path.resolve('test/tsconfig.json')
process.env.NODE_ENV = 'development'

global.oclif = global.oclif || {}
global.oclif.columns = 80

chai.use(chaiAsPromised)