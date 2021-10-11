release: node_modules .pipenv lint test bundle-python

lint:
	pipenv run black --line-length 120 serverless_flask
	pipenv run flake8 serverless_flask

clean: 
	find -name '*.pyc' | xargs rm -f
	find -name '__pycache__' | xargs rm -rf
	rm -rf cdk.out/
	rm -rf build-python/
	rm -rf .aws-sam/
	rm -f requirements.txt
	rm -f .deploy-dev-once
	rm -rf node_modules
	rm -f sam-params.json
	rm -f .pipenv && pipenv --rm || true
	echo "Clean is finished"

.pipenv:
	pipenv sync -d
	touch "$@"

run-flask: .pipenv .deploy-dev-once
	# Reads the same environment variable that Lambda will use.
	FLASK_APP=serverless_flask:create_app \
	JSON_CONFIG_OVERRIDE=`jq -r '."serverless-flask-dev".LambdaEnv' cdk.out/dev-stage-output.json` \
	AWS_PROFILE=serverless-flask-dev \
	FLASK_ENV=dev \
	FLASK_DEBUG=1 \
	pipenv run  flask run --cert adhoc -h localhost -p 5000 

update-deps: clean
	pipenv update

build-python: .pipenv
	mkdir -p "$@"/
	echo "Building in $@/"
	pipenv lock -r > requirements.txt
	pip3 install -r requirements.txt -t "$@/"
	# prune botocore and boto3 because they come with Lambda runtime
	rm -rf "$@/boto3"
	rm -rf "$@/botocore"
	# prune other trash
	find "$@/" -name "__pycache__" -type d | xargs rm -rf
	find "$@/" -name "*.pyc" -type d | xargs rm -rf
	rm -rf "$@/{_pytest}"

bundle-python: build-python
	echo "Copying local Python files"
	rsync -ah --exclude '*.pyc' serverless_flask  "build-python/"
	echo "The Python bundle's size: $$(du -sh "build-python/")"

pytest:
	pipenv run pytest -x

npmtest:
	npm run test

test: pytest npmtest

node_modules:
	npm install


deploy-dev: node_modules bundle-python
	cdk deploy -c stage=dev --outputs-file cdk.out/dev-stage-output.json
	
.deploy-dev-once: node_modules
	cdk deploy -c stage=dev --outputs-file cdk.out/dev-stage-output.json
	touch $@

deploy-staging: release
	cdk deploy -c stage=staging

deploy-prod: release
	cdk deploy -c stage=prod

synth-dev: node_modules
	cdk synth -c stage=dev

sam-params.json:
	jq -r '{"Parameters":{"JSON_CONFIG_OVERRIDE": ."serverless-flask-dev".LambdaEnv}}' cdk.out/dev-stage-output.json > "$@"

sam-local: .deploy-dev-once bundle-python synth-dev sam-params.json
	sam local start-api -p 5000 -t cdk.out/ServerlessFlask.template.json \
	-n sam-params.json
	rm -f sam-params.json

.PHONY = clean run-flask bundle-python test pytest npmtest \
	sam-local deploy-dev deploy-staging deploy-prod release  \
	update-deps synth-dev npm-install lint
	