```
$ docker run --rm -e AWS_REGION=ap-northeast-1 asannou/aws-elb-apache-log myawsbucket AWSLogs/123456789012/elasticloadbalancing/ap-northeast-1/2017/03/14/
203.0.113.1 - - [14/Mar/2017:07:12:27 +0000] "GET / HTTP/1.1" 200 0
203.0.113.1 - - [14/Mar/2017:07:12:27 +0000] "GET /favicon.ico HTTP/1.1" 200 0
```

or

```
$ npm install
$ AWS_REGION=ap-northeast-1 npm start -s myawsbucket AWSLogs/123456789012/elasticloadbalancing/ap-northeast-1/2017/03/14/
```
