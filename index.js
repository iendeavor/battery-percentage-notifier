let yargs
let shell
try {
  yargs = require('yargs')
    .option('less-than', {
      alias: 'l',
      type: 'number',
      default: 20,
      description: '當電量少於該%數，跳出警告'
    })
    .option('detect-interval', {
      alias: 'd',
      type: 'number',
      default: 60,
      description: '偵測電量的間隔時間 (以秒為單位)'
    })
  shell = require('shelljs')
  // notifier = new (require('node-notifier')).NotificationCenter()
  notifier = require('node-notifier')
} catch (error) {
  throw Error('請先執行 `yarn install`')
}

const gDetectInterval = yargs.argv.detectInterval * 1000
const gLessThan = yargs.argv.lessThan
let gCurrentPercentages = []
let maxDeviceCount = 0
let count = 0

function detect() {
  const result = shell.exec(`ioreg -l | grep BatteryPercent`, { silent: true }).stdout.trim()

  maxDeviceCount = result.split('\n').length
  count = (count + 1) % maxDeviceCount
  gCurrentPercentages = result.split('\n').map(line => parseInt(line.split(' ').slice(-1)[0], 10))
}

async function warn () {
  return new Promise((resolve, reject) => {
    try {
      gCurrentPercentages.forEach(percentage => {
        if (gLessThan > percentage) {
          notify(percentage)
        }
      })
      resolve()
    } catch (error) {
      console.log(error)
      reject(error)
    }
  })
}

function notify (percentage) {
  notifier.notify(
    {
      title: `請充電!`,
      message: `電量剩餘: ${percentage}%`,
      timeout: gDetectInterval / 1000,
    },
  )
}

function log () {
  shell.exec('clear')
  console.log(`外接設備電量偵測中...`)
  console.log(`偵測間隔: ${gDetectInterval / 1000}s`)
  console.log(`低於電量: ${gLessThan}% 將會提醒`)
  console.log()
  gCurrentPercentages.forEach(percentage => {
    console.log(`目前剩餘電量: ${percentage}%`)
  })
}

async function sleep (ms) {
  return new Promise (resolve => {
    setTimeout(resolve, ms)
  })
}

(async function exec () {
  while (true) {
    await detect()
    await log()
    await warn()
    await sleep(gDetectInterval)
  }
})()
