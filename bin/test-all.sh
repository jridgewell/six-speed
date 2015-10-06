. ~/.nvm/nvm.sh

npm update

rm -rf browsers
mkdir browsers
./node_modules/.bin/browser-downloader browsers

nvm install 0.12
nvm install 4

./node_modules/.bin/gulp build

./node_modules/.bin/gulp test:local
./node_modules/.bin/gulp test:sauce

nvm use --delete-prefix 0.12
./node_modules/.bin/gulp test:node

nvm use --delete-prefix 4
./node_modules/.bin/gulp test:node
