import { getConfig, getDMMF, parseEnvValue } from '@prisma/sdk'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

import type { GetPrismaClientConfig } from '../../runtime/getPrismaClient'
import { getPrismaClient } from '../../runtime/getPrismaClient'

let prismaClientOptions: GetPrismaClientConfig
let config

// Keep original process.env
const originalEnv = process.env

beforeAll(async () => {
  // Change process.env for dataproxy tests
  process.env = {
    ...originalEnv,
    PRISMA_CLIENT_ENGINE_TYPE: 'dataproxy',
    PRISMA_CLI_QUERY_ENGINE_TYPE: 'library',
  }

  const schema = fs.readFileSync(path.join(__dirname, 'schema.prisma'), { encoding: 'utf8' })
  config = await getConfig({ datamodel: schema })
  const prismaClientDmmf = await getDMMF({ datamodel: schema })
  const schemaContentsBase64 = Buffer.from(schema).toString('base64')
  const schemaContentsHashed = crypto.createHash('sha256').update(schemaContentsBase64).digest('hex')

  prismaClientOptions = {
    inlineSchema: schemaContentsBase64,
    inlineSchemaHash: schemaContentsHashed,
    document: prismaClientDmmf,
    generator: {
      name: 'client',
      provider: {
        value: 'prisma-client-js',
        fromEnvVar: null,
      },
      config: { engineType: 'dataproxy' },
      output: null,
      binaryTargets: [],
      previewFeatures: [],
    },
    // clientVersion: '',
    dirname: path.dirname(__dirname),
    activeProvider: config.datasources[0].provider,
    datasourceNames: [config.datasources[0].name],
    relativePath: '',
    relativeEnvPaths: {
      rootEnvPath: '',
      schemaEnvPath: '',
    },
  }
})

afterAll(() => {
  // Restore process.env
  process.env = originalEnv
})

test('getPrismaClient: Data Proxy: Error: inlineDatasources is required', () => {
  expect.assertions(1)

  const PrismaClient = getPrismaClient({
    ...prismaClientOptions,
  })

  try {
    const prisma = new PrismaClient()
  } catch (e) {
    expect(e).toMatchInlineSnapshot(`Could not parse URL of the datasource`)
  }
})

test('getPrismaClient: Data Proxy: Error: Datasource URL must start with prisma://', () => {
  expect.assertions(1)

  const PrismaClient = getPrismaClient({
    ...prismaClientOptions,
    inlineDatasources: {
      [config.datasources[0].name]: {
        url: {
          fromEnvVar: null,
          value: parseEnvValue(config.datasources[0].url),
        },
      },
    },
  })

  try {
    const prisma = new PrismaClient()
  } catch (e) {
    expect(e).toMatchInlineSnapshot(`Datasource URL should use prisma:// protocol`)
  }
})

test('getPrismaClient: Data Proxy: InvalidDatasourceError: No valid API key found in the datasource URL', () => {
  expect.assertions(1)

  const PrismaClient = getPrismaClient({
    ...prismaClientOptions,
    inlineDatasources: {
      [config.datasources[0].name]: {
        url: {
          fromEnvVar: null,
          value: parseEnvValue(config.datasources[0].url).replace('postgresql://', 'prisma://'),
        },
      },
    },
  })

  try {
    const prisma = new PrismaClient()
  } catch (e) {
    expect(e).toMatchInlineSnapshot(`No valid API key found in the datasource URL`)
  }
})

test('getPrismaClient: Data Proxy: Error: client version is required', () => {
  expect.assertions(1)

  const PrismaClient = getPrismaClient({
    ...prismaClientOptions,
    inlineDatasources: {
      [config.datasources[0].name]: {
        url: {
          fromEnvVar: null,
          value: `${parseEnvValue(config.datasources[0].url).replace('postgresql://', 'prisma://')}?api_key=something`,
        },
      },
    },
  })

  try {
    const prisma = new PrismaClient()
  } catch (e) {
    expect(e).toMatchInlineSnapshot(
      `clientVersion or \`PRISMA_CLIENT_DATA_PROXY_CLIENT_VERSION\` env var needs to be set with a \`major.minor.patch\` version.`,
    )
  }
})

test('getPrismaClient: Data Proxy: Error: client version must be major.minor.patch', () => {
  expect.assertions(1)

  const PrismaClient = getPrismaClient({
    ...prismaClientOptions,
    clientVersion: 'does-not-exist',
    inlineDatasources: {
      [config.datasources[0].name]: {
        url: {
          fromEnvVar: null,
          value: `${parseEnvValue(config.datasources[0].url).replace('postgresql://', 'prisma://')}?api_key=something`,
        },
      },
    },
  })

  try {
    const prisma = new PrismaClient()
  } catch (e) {
    expect(e).toMatchInlineSnapshot(`Only \`major.minor.patch\` versions are supported.`)
  }
})
