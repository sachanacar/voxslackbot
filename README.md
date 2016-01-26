# Voxbone SlackBot 

This SlackBot allows you to automate the provision of phone numbers right into your Slack channel.

![voxslackbot](http://blog.voxbone.com/wp-content/uploads/2016/01/voxslack.gif)

More information about development and installation on the [Voxbone blog](http://blog.voxbone.com/automating-provisioning-slack-voxapi-part-1/).

## Install

To install the app, follow these instruction:

1. Download this repo (git clone)
2. Add the dependency to your application (npm install)
3. Host it on Heroku with the following set of commands

````
//go inside of the repo
cd voxslackbot

//Initialize it
git init

//Create a Heroku app
heroku create

//Add and commit
git add .
git commit -m ‘deploy’

//Push to Heroku
git push heroku master

//Tail the Heroku logs to see what is going on when you use it!
heroku logs --tail

//Now that your application is live, add your Heroku app URL int the configuration page of the Slack command you created.
````
