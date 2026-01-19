import path from 'node:path'
import { fileURLToPath } from 'node:url'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

process.env.TS_NODE_PROJECT = path.resolve(__dirname, '../tsconfig.json')
process.env.NODE_ENV = 'development'

// Localstack Config
process.env.AWS_REGION = 'us-east-1'
process.env.AWS_ACCESS_KEY_ID = 'abc'
process.env.AWS_SECRET_ACCESS_KEY = '123'

globalThis.oclif = globalThis.oclif || {}
globalThis.oclif.columns = 80

chai.use(chaiAsPromised)
