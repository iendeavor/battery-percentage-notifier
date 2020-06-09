let yargs
let shell
try {
  yargs = require('yargs')
    .option('less-than', {
      alias: 'l',
      type: 'number',
      default: 20,
      description: 'Critically Low Battery Notification Percentage'
    })
    .option('detect-interval', {
      alias: 'd',
      type: 'number',
      default: 60,
      description: 'Detect interval (In seconds)'
    })
  shell = require('shelljs')
  // notifier = new (require('node-notifier')).NotificationCenter()
  notifier = require('node-notifier')
} catch (error) {
  throw Error('Please run command `yarn install`.')
}

const gDetectInterval = yargs.argv.detectInterval * 1000
const gLessThan = yargs.argv.lessThan
const gErrors = []
let gDeviceInfoList = []
let maxDeviceCount = 0
let count = 0

function getDeviceInfoList () {
  const ioregInfo = shell.exec(`ioreg -l`, { silent: true }).stdout.trim().split('\n')
  const deviceInfoRangeList = []
  ioregInfo.forEach((line, beginIndex) => {
    if  (/\+\-o AppleDeviceManagementHIDEventService  <class AppleDeviceManagementHIDEventService/.test(line)) {
      let endIndex = beginIndex + 1
      while (/\+\-o /.test(ioregInfo[endIndex]) === false) ++endIndex
      deviceInfoRangeList.push([
        beginIndex,
        endIndex - 1,
      ])
    }
  })

  const deviceInfoList = []
  deviceInfoRangeList.forEach(([startIndex, endIndex]) => {
    let deviceInfo = []
    while (startIndex < endIndex) {
      deviceInfo.push(ioregInfo[startIndex++])
    }
    deviceInfoList.push(deviceInfo)
  })

  return deviceInfoList
}

function getProductOfDeviceInfo (deviceInfo) {
  return deviceInfo.find(line => /"Product" = /.test(line)).replace(/^.*= "(.*)"$/, '$1')
}

function getPercentageOfDeviceInfo (deviceInfo) {
  return parseInt(deviceInfo.find(line => /"BatteryPercent" = /.test(line)).replace(/^.*= (\d+).*$/, '$1'), 10)
}

function isChargingOfDeviceInfo (deviceInfo) {
  return deviceInfo.find(line => /"BatteryStatusFlags" = 3/.test(line)) !== undefined
}

function detect() {
  const result = shell.exec(`ioreg -l | grep BatteryPercent`, { silent: true }).stdout.trim()

  maxDeviceCount = result.split('\n').length
  count = (count + 1) % maxDeviceCount
  gDeviceInfoList = getDeviceInfoList()
}

async function warn () {
  try {
    for await (const deviceInfo of gDeviceInfoList) {
      const percentage = getPercentageOfDeviceInfo(deviceInfo)

      if (gLessThan <= percentage) continue
      if (isChargingOfDeviceInfo(deviceInfo)) continue

      await notify(deviceInfo)
    }
  } catch (error) {
    gErrors.push(error)
  }
}

function notify (deviceInfo) {
  return new Promise(resolve => notifier.notify(
    {
      title: `Please charge your ${ getProductOfDeviceInfo(deviceInfo) }`,
      message: `Battery percentage: ${ getPercentageOfDeviceInfo(deviceInfo) } %`,
      timeout: gDetectInterval / 1000,
    },
    function(error, response) {
      if (error) gErrors.push(error)
      resolve()
    }
  ))
}

function log () {
  shell.exec('clear')
  console.log(`Detecting ...`)
  console.log(`Detect interval: ${gDetectInterval / 1000} second${gDetectInterval / 1000 !== 1 ? 's' : ''}`)
  console.log(`Critically Low Battery Notification Percentage: ${gLessThan} %`)
  console.log('')

  gDeviceInfoList.forEach(deviceInfo => {
    const product = getProductOfDeviceInfo(deviceInfo)
    const percentage = getPercentageOfDeviceInfo(deviceInfo)
    const isCharging = isChargingOfDeviceInfo(deviceInfo)
    console.log(`Device: ${ product }`)
    console.log(`Percentage: ${ percentage }`)
    console.log(`Charging: ${ isCharging }`)
    console.log('')
  })

  if (gErrors.length) {
    console.log('Errors:')
    gErrors.forEach(error => console.log(`  ${error}`))
  }
}

async function sleep (ms) {
  return new Promise (resolve => {
    setTimeout(resolve, ms)
  })
}

(async function exec () {
  while (true) {
    detect()
    log()
    await warn()
    await sleep(gDetectInterval)
  }
})()
