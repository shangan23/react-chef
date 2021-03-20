#! /usr/bin/env node

const program = require('commander')
const inquirer = require('inquirer')
const chalk = require('chalk')
const shell = require('shelljs')

const slimConfig = require('./slim/config')
const slimSnippet = require('./slim/snippets')
const basicConfig = require(`./basic/config`)
const basicSnippet = require(`./basic/snippets`)

const {
  log,
  error,
  createFile,
  tryAccess,
  moduleSetInstall,
} = require('./utils')

program.option('-f, --app-name <value>', 'App Name')

program.parse(process.argv)

// Create App Directory.
const appName = program.args[0]

if (!appName) {
  console.error('Please specify the app name:')
  // multiline erro - do not change the indentation
  log(`${chalk.cyan('npx react-chef')} ${chalk.green('<app-name>')}

For example:
${chalk.cyan('npx react-chef')} ${chalk.green('my-app-name')}
`)
  error('`App name` missing')
}
let getConfig = slimConfig.getConfig
let getModulesList = slimConfig.getModulesList
let getDevModulesList = slimConfig.getDevModulesList
let getFileContent = slimSnippet.getFileContent
let getWebPackConfig = slimSnippet.getWebPackConfig
let getDynamicSourceCode = slimSnippet.getDynamicSourceCode
let baseConfig = getConfig()

const baseDirPath = `./${appName}`
const defaultProjectType = 'slim'
let projectType = defaultProjectType
const isSlimProject = (type) => type === defaultProjectType

tryAccess(baseDirPath)
  .then(
    () => {},
    function onPathExist() {
      error(
        `Choose different App name. ${appName} is already exist in ${process.cwd()}`
      )
    }
  )
  .then(() => {
    return inquirer.prompt([
      {
        type: 'list',
        name: 'projectType',
        message: 'choose your project type',
        choices: ['Slim', 'Basic'],
        default: 'Slim',
      },
    ])
  })
  .then((mainAnswer) => {
    projectType = mainAnswer.projectType.toLowerCase()
    log(`projectType: ${projectType}`)
    if (!isSlimProject(projectType)) {
      log(`not slim - projectType: ${projectType}`)
      getConfig = basicConfig.getConfig
      getModulesList = basicConfig.getModulesList
      getDevModulesList = basicConfig.getDevModulesList
      getFileContent = basicSnippet.getFileContent
      getWebPackConfig = basicSnippet.getWebPackConfig
      getDynamicSourceCode = basicSnippet.getDynamicSourceCode
      baseConfig = getConfig()
    }
  })
  .then(() => {
    return shell.which('npm')
  })
  .then(() => {
    const projectQuestions = [
      {
        type: 'list',
        name: 'portNumber',
        message: 'choose your port number',
        choices: [3000, 4000, 5000, 6000, 7000],
        default: 7000,
      },
    ]

    if (baseConfig.canAdd.eslint) {
      projectQuestions.push({
        type: 'confirm',
        name: 'eslint',
        message: 'do you want to add eslint?',
        default: true,
      })
    }

    if (baseConfig.canAdd.prettier) {
      projectQuestions.push({
        type: 'confirm',
        name: 'prettier',
        message: 'do you want to add prettier?',
        default: false,
      })
    }

    if (baseConfig.canAdd.husky) {
      projectQuestions.push({
        type: 'confirm',
        name: 'husky',
        message:
          'do you want to add husky which enables linting and prettier on pre-commit hook?',
        default: false,
      })
    }

    if (baseConfig.canAdd.hookForm) {
      projectQuestions.push({
        type: 'confirm',
        name: 'hookForm',
        message: 'do you want to add react-hook-form?',
        default: false,
      })
    }

    return inquirer.prompt(projectQuestions)
  })
  .then((answers) => {
    shell.mkdir(baseDirPath)
    shell.cd(appName)
    shell.exec('npm init -y', { silent: true })

    return answers
  })
  .then((answers) => {
    const babelConfigFileName = `.babelrc`
    createFile(babelConfigFileName, getFileContent(babelConfigFileName))

    createFile(
      'webpack.config.js',
      getWebPackConfig(appName, {
        ...baseConfig,
        portNumber: answers.portNumber,
      })
    )

    if (answers.eslint) {
      const eslintConfigFileName = `.eslintrc.json`
      createFile(eslintConfigFileName, getFileContent(eslintConfigFileName))
    }

    if (answers.prettier) {
      const prettierConfigFileName = `.prettierrc.json`
      createFile(prettierConfigFileName, getFileContent(prettierConfigFileName))
    }

    shell.mkdir(baseConfig.sourceDir.main)
    shell.cd(baseConfig.sourceDir.main)

    const indexFile = 'index.js'
    createFile(indexFile, getDynamicSourceCode(indexFile, appName, baseConfig))

    const AppFile = 'App.js'
    createFile(AppFile, getDynamicSourceCode(AppFile, appName, baseConfig))

    if (baseConfig.canAdd.routes) {
      const RoutesFile = 'Routes.js'
      createFile(
        RoutesFile,
        getDynamicSourceCode(RoutesFile, appName, baseConfig)
      )
    }

    const sourceSnippetDir = `${__dirname}/${projectType}/snippets/sources`

    if (baseConfig.canAdd.utils) {
      // Copy Utils.
      shell.cp('-Rf', `${sourceSnippetDir}/utils`, '.')
    }

    if (baseConfig.canAdd.static) {
      // Copy Static.
      shell.cp('-Rf', `${sourceSnippetDir}/static`, '.')
    }

    if (baseConfig.canAdd.i18n) {
      // Copy i18n.
      shell.cp('-Rf', `${sourceSnippetDir}/i18n`, '.')

      shell.cd(baseConfig.sourceDir.i18n)
      const withI18n = `withI18n.js`
      createFile(withI18n, getDynamicSourceCode(withI18n, appName, baseConfig))
      shell.cd('..')
    }

    if (baseConfig.canAdd.modules) {
      // Copy Modules.
      shell.cp('-Rf', `${sourceSnippetDir}/modules`, '.')

      shell.cd(
        `${baseConfig.sourceDir.containers}/${baseConfig.modules.signIn}`
      )
      const signInModule = 'SignIn.js'
      createFile(
        signInModule,
        getDynamicSourceCode(signInModule, appName, baseConfig)
      )

      shell.cd(`../${baseConfig.modules.dashboard}`)
      const dashboardModule = 'Dashboard.js'
      createFile(
        dashboardModule,
        getDynamicSourceCode(dashboardModule, appName, baseConfig)
      )
      shell.cd('../../')
    }

    if (baseConfig.canAdd.componentsCopy && !baseConfig.canAdd.fullComponents) {
      // Copy Components.
      shell.cp('-Rf', `${sourceSnippetDir}/components`, '.')
    } else if (baseConfig.canAdd.fullComponents) {
      // Copy Components.
      shell.cp('-Rf', `${sourceSnippetDir}/components`, '.')
      const pageLoader = 'PageLoader'
      shell.cd(
        `${baseConfig.sourceDir.components}/${baseConfig.sourceDir.businessLogic}/Loader/${pageLoader}`
      )
      const pageLoaderBlock = `${pageLoader}.js`
      createFile(
        pageLoaderBlock,
        getDynamicSourceCode(pageLoaderBlock, appName, baseConfig)
      )

      const sidebar = 'Sidebar'
      shell.cd(`../../Region/${sidebar}`)
      const sidebarBlock = `${sidebar}.js`
      createFile(
        sidebarBlock,
        getDynamicSourceCode(sidebarBlock, appName, baseConfig)
      )

      const topBar = 'TopBar'
      shell.cd(`../../Region/${topBar}`)
      const topBarBlock = `${topBar}.js`
      createFile(
        topBarBlock,
        getDynamicSourceCode(topBarBlock, appName, baseConfig)
      )
      shell.cd('../../../../')
    }

    log(chalk.green.underline.bold('Installing App dependencies...'))
    const dependencyList = [
      ...getModulesList(),
      ...(answers.hookForm ? ['form'] : []),
    ]
    moduleSetInstall('-S', dependencyList)

    log(chalk.green.underline.bold('Installing App dev dependencies...'))
    const devDependencyList = [
      ...getDevModulesList(),
      ...(answers.eslint ? ['eslint'] : []),
      ...(answers.prettier ? ['prettier'] : []),
      ...(answers.husky ? ['husky'] : []),
    ]
    moduleSetInstall('-D', devDependencyList)

    shell.cd('..')
    const packageFileContent = shell.cat('package.json')
    const packageFileObject = JSON.parse(packageFileContent)
    packageFileObject.scripts = {
      dev: 'webpack serve --mode development',
      build: 'webpack --mode production --progress',
      ...(answers.eslint
        ? {
            lint: 'eslint src --ext .js',
          }
        : {}),
      ...(answers.prettier
        ? {
            prettier: 'prettier --write src',
          }
        : {}),
      clean: 'rm -rf node_modules',
    }
    delete packageFileObject.main
    shell.rm('package.json')
    createFile('package.json', JSON.stringify(packageFileObject, null, 2))
  })
  .catch((e) => {
    error(e, true)
  })
