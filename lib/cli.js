#!/usr/bin/env node

const fs = require('fs')
const ora = require('ora')
const execa = require('execa')
const program = require('commander')
const inquirer = require('inquirer')
const child_process = require('child_process')
const cli_version = require('../package.json').version

const spinner = ora('docker-version')

const getName = async () => {
  if (program.name.length) {
    return program.name
  }

  let version_path = process.cwd() + '/.docker-version'
  if (fs.existsSync(version_path)) {
    let data = fs.readFileSync(version_path, 'utf8')
    return data.trim().split(`\n`).join('.')
  }

  let questions = {
    type: 'input',
    name: 'name',
    message: 'what is your docker images name?'
  }
  let answer = await inquirer.prompt(questions)
  return answer.name
}

const getVersion = async () => {
  if (program.tag.length) {
    return program.tag
  }

  let questions = {
    type: 'input',
    name: 'tag',
    message: 'what is your docker images latest version?'
  }
  let answer = await inquirer.prompt(questions)
  return answer.tag
}

const autotag = async (name, version) => {

  if (!name.includes('latest')) {
    console.log(`skip ${name}`)
    return
  }

  version = version.split('.')

  let dev_keyword = ['-dev', '-rc', '-alpha', '-beta', '-pre']
  let isdev = dev_keyword.some(keyword => version[version.length - 1].includes(keyword))

  let tags = []
  for (let i = version.length; i > 0; i -= 1) {
    let t = version.slice(0, i).join('.')
    tags.push(t)
    if (isdev) break
  }
  tags.push(isdev ? 'dev' : 'current')
  tags = tags.map(x => name.replace('latest', x))

  spinner.start()

  spinner.text = `pulling (docker pull ${name})`
  {
    let result = await execa.shell(`docker pull ${name}`)
    if (result.code) {
      spinner.fail(`pull ${name}`)
      return
    }
  }
  spinner.succeed(`pull ${name}`)

  for (let tag of tags) {
    {
      spinner.start()
      let shell = `docker tag ${name} ${tag}`
      spinner.text = `tagging (${shell})`
      let result = await execa.shell(shell)
      if (result.code) {
        spinner.fail(`tag ${tag}`)
      }
      spinner.succeed(`tag ${tag}`)
    }
    {
      spinner.start()
      let shell = `docker push ${tag}`
      spinner.text = `pushing (${shell})`
      let result = await execa.shell(shell)
      if (result.code) {
        spinner.fail(`push ${tag}`)
      }
      spinner.succeed(`push ${tag}`)
    }
  }

  spinner.stop()
}

const app = async () => {
  let names = await getName()
  names = names.split(',').map(x => x.trim())

  let version = await getVersion()

  for (let name of names) {
    await autotag(name, version)
  }
}

program
  .version(cli_version)
  .option('-n, --name [name]', 'Docker images name', '')
  .option('-t, --tag [tag]', 'Docker images tag/version', '')
  .parse(process.argv)

app()
