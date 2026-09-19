## [1.3.2](https://github.com/rcasia/principled/compare/web-v1.3.1...web-v1.3.2) (2026-09-19)


### Bug Fixes

* **infra:** let the deploy role publish edge signer versions ([0701e84](https://github.com/rcasia/principled/commit/0701e841498150314fdcb64e0ede7a2e24f31270))

## [1.3.1](https://github.com/rcasia/principled/compare/web-v1.3.0...web-v1.3.1) (2026-09-19)


### Bug Fixes

* **infra:** let the deploy role enable Lambda@Edge replication ([6fdc58d](https://github.com/rcasia/principled/commit/6fdc58d1c313c9f6787fa154d1200391af7c37cb))

# [1.3.0](https://github.com/rcasia/principled/compare/web-v1.2.0...web-v1.3.0) (2026-09-19)


### Bug Fixes

* **infra:** defer edge signer zip hashing until built ([ac757b3](https://github.com/rcasia/principled/commit/ac757b3db472c69f41486394c851c904e3ffea77))
* **infra:** give the us-east-1 provider LocalStack credentials ([2fed090](https://github.com/rcasia/principled/commit/2fed090e920349d0660790c81076dcd377ec600c))


### Features

* **infra:** sign CloudFront origin requests with Lambda@Edge so POST works ([8ab1c22](https://github.com/rcasia/principled/commit/8ab1c22d3426a02734d83dee4c9aa17964c4d8ef))

# [1.2.0](https://github.com/rcasia/principled/compare/web-v1.1.0...web-v1.2.0) (2026-09-19)


### Features

* **ci:** run the cli and web release trains in parallel ([75e9f2b](https://github.com/rcasia/principled/commit/75e9f2bc18844fe696ff7e00ac9f5d80cf1e0598))

# [1.1.0](https://github.com/rcasia/principled/compare/web-v1.0.2...web-v1.1.0) (2026-09-19)


### Features

* **release:** route release trains by changed files ([3444019](https://github.com/rcasia/principled/commit/3444019ed4b02b9f0c93e55961d7585c46ed8cf9))

## [1.0.2](https://github.com/rcasia/principled/compare/web-v1.0.1...web-v1.0.2) (2026-09-19)


### Bug Fixes

* **infra:** revert to OAC after finding an org SCP blocks public Function URLs ([6067832](https://github.com/rcasia/principled/commit/606783274829cac5191238a3d0e56f6b2e4a5036))

## [1.0.1](https://github.com/rcasia/principled/compare/web-v1.0.0...web-v1.0.1) (2026-09-19)


### Bug Fixes

* **infra:** restore prod by detaching OAC before deleting it ([4433f27](https://github.com/rcasia/principled/commit/4433f27fa62a09430eacac4dc7c342fcb6da2c25))

# 1.0.0 (2026-09-19)


### Bug Fixes

* **ci:** check out main's current tip in release-web and deploy ([42634aa](https://github.com/rcasia/principled/commit/42634aa7e89cd08ba4a7b34c71c0e78417fbb2aa))
* **ci:** don't let bun audit's outage block the pipeline ([eab51de](https://github.com/rcasia/principled/commit/eab51de2252468cfb8702378f9084e2ba35db769)), closes [#48](https://github.com/rcasia/principled/issues/48)
* **ci:** join lambda containers to the localstack network ([eafc620](https://github.com/rcasia/principled/commit/eafc6208940e53f89cb5227e2e86359cdb0be5dc))
* **ci:** let localstack ignore the lambda architecture ([8a68a32](https://github.com/rcasia/principled/commit/8a68a326de6a74c32570fd00650b27a49f624e45))
* **deps:** override qs to a version without known advisories ([94e7656](https://github.com/rcasia/principled/commit/94e7656b3b0da6d29295b90822f8448423f0f568))
* **infra:** allow POST through CloudFront so /analyze works in prod ([b15393c](https://github.com/rcasia/principled/commit/b15393c15fc9c1f7f9b51e0d9f59b4fb29967337)), closes [#34](https://github.com/rcasia/principled/issues/34)
* **infra:** match github's immutable oidc subject claim format ([421a96a](https://github.com/rcasia/principled/commit/421a96a44c15b78f781428d18f2e5b04421d894d))
* **infra:** protect origin with a secret header so POST /analyze works in prod ([f7b4c8d](https://github.com/rcasia/principled/commit/f7b4c8d9f477e44edc0e51219655a7405ec75a6e))
* **infra:** stop the managed cache policy from reintroducing host ([2016e3f](https://github.com/rcasia/principled/commit/2016e3f1f32b65e7a417409c2a8c7a0a314129e6))
* **release:** stop listing package.json as a release asset ([428f808](https://github.com/rcasia/principled/commit/428f8084865de43f9f5a82decbf32a9fd5f50f36))
* **release:** write the cli version without npm version ([1c5fd2e](https://github.com/rcasia/principled/commit/1c5fd2e74adb5bebd19d4cef9180b8d1718443b1))
* **web:** show Principled in the page title and heading ([c7d2dac](https://github.com/rcasia/principled/commit/c7d2dacd41932f00eafc32d9ce1563c280291e4c))


### Features

* **ci:** gate on bun audit at commit time, in CI, and weekly ([d985ad5](https://github.com/rcasia/principled/commit/d985ad5cb8f0855dfefb35e567bfbf6ee7bf92c1))
* **core:** add analysis run read model for event replay ([4b49a6b](https://github.com/rcasia/principled/commit/4b49a6b39dd6b51edc11c49affe3e93b2674b8ec)), closes [#9](https://github.com/rcasia/principled/issues/9) [#34](https://github.com/rcasia/principled/issues/34)
* **core:** add event sourcing and CQRS foundation ([3402b44](https://github.com/rcasia/principled/commit/3402b4453f2bc0661b5bfe4b3246065262f1df53)), closes [#34](https://github.com/rcasia/principled/issues/34) [#34](https://github.com/rcasia/principled/issues/34) [#33](https://github.com/rcasia/principled/issues/33) [#34](https://github.com/rcasia/principled/issues/34)
* **core:** add principles slice with a stub domain ([53b59ba](https://github.com/rcasia/principled/commit/53b59ba5b4e31c6ca167c4d302241d3db3846528))
* **core:** build the rule evaluation engine ([c1f8ab8](https://github.com/rcasia/principled/commit/c1f8ab8bfd0ef30790750aa343692b2d96b6307a)), closes [#9](https://github.com/rcasia/principled/issues/9) [#8](https://github.com/rcasia/principled/issues/8) [#33](https://github.com/rcasia/principled/issues/33)
* **core:** define analysis result contract ([08ef528](https://github.com/rcasia/principled/commit/08ef528428454c12cdc26bdd874b7abe51a812a4)), closes [#9](https://github.com/rcasia/principled/issues/9) [#8](https://github.com/rcasia/principled/issues/8)
* **infra:** add bootstrap module for state bucket and deploy role ([85b4f1e](https://github.com/rcasia/principled/commit/85b4f1ef7437831c966a7c2bef00b57d495ba1ac))
* **infra:** provision the web lambda with terraform ([3062450](https://github.com/rcasia/principled/commit/30624506f3c2c31786de0f042c1b9e509d71134f))
* **infra:** serve globally through cloudfront with a locked-down origin ([8d0795f](https://github.com/rcasia/principled/commit/8d0795f5d89472cb1b3e1b8e40c95e42b24e66a2))
* **release:** split the cli and web release trains by commit scope ([9c2f4b9](https://github.com/rcasia/principled/commit/9c2f4b950ecb44bf7e2f9ec1a92581459eb59b23))
* **web:** add lambda function url adapter ([d78e0a8](https://github.com/rcasia/principled/commit/d78e0a8433169a47ce4ac649e0faf9792df7cdd0))
* **web:** analyze a single source file on the web ([d3d9fc0](https://github.com/rcasia/principled/commit/d3d9fc0106c636a5fc58c473dca160e2cc52a60b)), closes [#34](https://github.com/rcasia/principled/issues/34) [10-#14](https://github.com/10-/issues/14)
* **web:** establish product design foundation ([085e11c](https://github.com/rcasia/principled/commit/085e11cef7a4175fb1e5821e31052a9a7319dd47))
* **web:** make responses cacheable ([174fce1](https://github.com/rcasia/principled/commit/174fce1c2c7ae2833e3d8daefb3dd76a9ae2c049))
* **web:** serve an accessible server-rendered principles page ([57e9323](https://github.com/rcasia/principled/commit/57e9323ab0386b718c2e79a56e948d098c7c96e7))
