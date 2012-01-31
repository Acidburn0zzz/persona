#!/usr/bin/env node

const
aws = require('./deploy/aws.js');
path = require('path');
vm = require('./deploy/vm.js'),
key = require('./deploy/key.js'),
ssh = require('./deploy/ssh.js'),
git = require('./deploy/git.js'),
dns = require('./deploy/dns.js');

var verbs = {};

function checkErr(err) {
  if (err) {
    process.stderr.write('fatal error: ' + err + "\n");
    process.exit(1);
  }
}

function printInstructions(name, deets) {
  console.log("Yay!  You have your very own deployment.  Here's the basics:\n");
  console.log(" 1. deploy your code:  git push " + name + " <mybranch>:master");
  console.log(" 2. visit your server on the web: https://" + name + ".hacksign.in");
  console.log(" 3. test via a website: http://" + name + ".myfavoritebeer.org");
  console.log(" 4. ssh in with sudo: ssh ec2-user@" + name + ".hacksign.in");
  console.log(" 5. ssh as the deployment user: ssh app@" + name + ".hacksign.in\n");
  console.log("enjoy!  Here's your server details", JSON.stringify(deets, null, 4));
}

verbs['deploy'] = function(args) {
  if (!args || args.length != 1) {
    throw 'missing required argument: name of instance';
  }
  var name = args[0];
  if (!/^[a-z][0-9a-z_\-]*$/.test(name)) {
    throw "invalid name!  must be a valid dns fragment ([z-a0-9\-_])";
  }
  console.log("attempting to set up " + name + ".hacksign.in");
      
  vm.startImage(function(err, r) {
    checkErr(err);
    console.log("   ... VM launched, waiting for startup (should take about 20s)");
    vm.waitForInstance(r.instanceId, function(err, deets) {
      checkErr(err);
      console.log("   ... Instance ready, setting name");
      vm.setName(r.instanceId, args[0], function(err) {
        checkErr(err);
        console.log("   ... name set, waiting for ssh access and configuring");
        var config = { public_url: "https://" + name + ".hacksign.in"};

        ssh.copyUpConfig(deets.ipAddress, config, function(err, r) {
          checkErr(err);
          console.log("   ... victory!  server is accessible and configured");
          git.addRemote(name, deets.ipAddress, function(err, r) {
            checkErr(err);
            console.log("   ... and your git remote is all set up");
            console.log("");
            printInstructions(name, deets);
          });
        });
      });
    });
  });
};

verbs['test'] = function(args) {
  dns.addRecord('foo', "1.2.3.4", function(err, r) {
    console.log(err, r);
  });
};

verbs['list'] = function(args) {
  vm.list(function(err, r) {
    checkErr(err);
    console.log(JSON.stringify(r, null, 2));
  });
};

var error = (process.argv.length <= 2); 

if (!error) {
  var verb = process.argv[2];
  if (!verbs[verb]) error = "no such command: " + verb;
  else {
    try {
      verbs[verb](process.argv.slice(3));
    } catch(e) {
      error = "error running '" + verb + "' command: " + e;
    }
  }
}

if (error) {
  if (typeof error === 'string') process.stderr.write('fatal error: ' + error + "\n\n");

  process.stderr.write('A command line tool to deploy BrowserID onto Amazon\'s EC2\n');
  process.stderr.write('Usage: ' + path.basename(__filename) +
                       ' <' + Object.keys(verbs).join('|') + "> [args]\n");
  process.exit(1);
}
