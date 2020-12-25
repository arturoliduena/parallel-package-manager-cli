#!/usr/bin/env node
const chalk = require('chalk');
const { Command } = require('commander');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const program = new Command();
program.version('0.0.1');

const adapter = new FileSync('parallel.json')
const db = low(adapter)

// Set some defaults (required if your JSON file is empty)
db.defaults({ packages: {}, installed: [] })
  .write();

const success = chalk.green('success');
const warning = chalk.yellow('warning');
const error = chalk.red('error');
const info = chalk.blue('info');

const memoGetDependencies = async (dependencies) => {
  const packages = await db.get('packages').toJSON();
  const cache = {};
  const getDependencies = (depends = []) => {
    return depends.reduce((all, package) => {
      if (!cache[package]) {
        cache[package] = true;
        all.push(package);
        const nextDepends = packages[package] || [];
        return [...all, ...getDependencies(nextDepends)];
      }
      return all;
    }, [])
  };
  return getDependencies(dependencies);
}

program
  .command('depends <name>')
  .option('-d, --dependencies [dependencies...]', 'dependencies', [])
  .description('Sets the dependencies of a package')
  .action((name, opts) => {
    // Set a dependencies using Lodash shorthand syntax
    console.log({ name, dependencies: opts.dependencies})
    db.set(`packages.${name}`, opts.dependencies || [])
      .write();
    console.log(`
${warning} parallel.json found. Your project contains parallel file generated.
${success} Saved parallel.json file.
${success} Saved ${opts.dependencies.length + 1} new dependencies.
${info} Direct dependencies
└─ ${name}
${info} All dependencies
${opts.dependencies.map(d => `├─ ${d} \n`).join('')}└─ ${name}
✨  Done!`)
  })

program
  .command('install <name>')
  .description('Install the specified package and any necessary transient dependencies.')
  .action((name) => {
    const hasPackage = db.get('packages').has(name).toJSON();
    if(!hasPackage){
      console.log(`${error} a package called "${chalk.green(name)}" does not exist. ${chalk.red('This command has had no effect.')}`);
      return;
    }
    const hasItem = !(db.get('installed').findIndex(p => p === name).toJSON() == -1);
    if(hasItem){
      console.log(`${warning} There's already a package called "${chalk.green(name)}" installed. ${chalk.red('This command has had no effect.')}`);
    } else {
      // Add a dependencies
      db.get('installed')
        .push(name)
        .write()
      console.log(`${success} ${chalk.blue(name)} installed`);
    }
  });

program
  .command('uninstall <name>')
  .description('Uninstall the specified package and any transient dependencies that are not dependent of other installed packages.')
  .action((name) => {
    // remove installed package
    db.get('installed')
      .remove( p => p === name)
      .write()
      console.log(`${success} ${chalk.blue(name)} uninstalled`);
  });

program
  .option('-o, --order-by <type>', 'order by')
  .command('list')
  .description('Lists all the installed packages, including transient dependencies.')
  .action(async (opts) => {
    const dependencies = await db.get('installed').toJSON();
    const all = await memoGetDependencies(dependencies);
    if(!all.length){
      console.log(chalk.blue(`${success} There are not packages installed`));
    } else {
      console.log(`${success} dependencies:
${
  all.map((d, index) => `${all.length - 1 !== index ? '├─' : '└─'} ${d} \n`).join('')
}
✨  Done!`)
    }
  });

program.parse(process.argv);


// console.log(chalk.blue('Hello world!'));