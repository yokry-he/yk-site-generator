import { Hono } from 'hono'
import { getDataStoreHealth } from '../lib/data-store'

const health = new Hono()

health.get('/', async (c) => {
  const dataStore = await getDataStoreHealth()
  return c.json(
    {
      ok: dataStore.status === 'operational',
      service: 'yk-site-generator',
      time: new Date().toISOString(),
      dataStore,
    },
    dataStore.status === 'operational' ? 200 : 503,
  )
})

export default health
