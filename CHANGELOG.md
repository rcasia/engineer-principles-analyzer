## [1.3.2](https://github.com/rcasia/engineer-principles-analyzer/compare/v1.3.1...v1.3.2) (2026-09-19)


### Bug Fixes

* **infra:** stop the managed cache policy from reintroducing host ([2016e3f](https://github.com/rcasia/engineer-principles-analyzer/commit/2016e3f1f32b65e7a417409c2a8c7a0a314129e6))

## [1.3.1](https://github.com/rcasia/engineer-principles-analyzer/compare/v1.3.0...v1.3.1) (2026-09-19)


### Bug Fixes

* **infra:** match github's immutable oidc subject claim format ([421a96a](https://github.com/rcasia/engineer-principles-analyzer/commit/421a96a44c15b78f781428d18f2e5b04421d894d))

# [1.3.0](https://github.com/rcasia/engineer-principles-analyzer/compare/v1.2.0...v1.3.0) (2026-09-19)


### Features

* **infra:** serve globally through cloudfront with a locked-down origin ([8d0795f](https://github.com/rcasia/engineer-principles-analyzer/commit/8d0795f5d89472cb1b3e1b8e40c95e42b24e66a2))
* **web:** make responses cacheable ([174fce1](https://github.com/rcasia/engineer-principles-analyzer/commit/174fce1c2c7ae2833e3d8daefb3dd76a9ae2c049))

# [1.2.0](https://github.com/rcasia/engineer-principles-analyzer/compare/v1.1.0...v1.2.0) (2026-09-19)


### Bug Fixes

* **release:** write the cli version without npm version ([1c5fd2e](https://github.com/rcasia/engineer-principles-analyzer/commit/1c5fd2e74adb5bebd19d4cef9180b8d1718443b1))


### Features

* **cli:** make the cli publishable to npm as principled ([0143f8c](https://github.com/rcasia/engineer-principles-analyzer/commit/0143f8c885f239302a77500ffd81d9e8859f8890))

# [1.1.0](https://github.com/rcasia/engineer-principles-analyzer/compare/v1.0.1...v1.1.0) (2026-09-19)


### Features

* **infra:** add bootstrap module for state bucket and deploy role ([85b4f1e](https://github.com/rcasia/engineer-principles-analyzer/commit/85b4f1ef7437831c966a7c2bef00b57d495ba1ac))

## [1.0.1](https://github.com/rcasia/engineer-principles-analyzer/compare/v1.0.0...v1.0.1) (2026-09-19)


### Bug Fixes

* **release:** stop listing package.json as a release asset ([428f808](https://github.com/rcasia/engineer-principles-analyzer/commit/428f8084865de43f9f5a82decbf32a9fd5f50f36))

# 1.0.0 (2026-09-19)


### Bug Fixes

* **ci:** join lambda containers to the localstack network ([eafc620](https://github.com/rcasia/engineer-principles-analyzer/commit/eafc6208940e53f89cb5227e2e86359cdb0be5dc))
* **ci:** let localstack ignore the lambda architecture ([8a68a32](https://github.com/rcasia/engineer-principles-analyzer/commit/8a68a326de6a74c32570fd00650b27a49f624e45))


### Features

* **cli:** add epa command listing known principles ([9e16ae5](https://github.com/rcasia/engineer-principles-analyzer/commit/9e16ae519c006ac87d3ae3682a308f147d75a902))
* **core:** add principles slice with a stub domain ([53b59ba](https://github.com/rcasia/engineer-principles-analyzer/commit/53b59ba5b4e31c6ca167c4d302241d3db3846528))
* **infra:** provision the web lambda with terraform ([3062450](https://github.com/rcasia/engineer-principles-analyzer/commit/30624506f3c2c31786de0f042c1b9e509d71134f))
* **web:** add lambda function url adapter ([d78e0a8](https://github.com/rcasia/engineer-principles-analyzer/commit/d78e0a8433169a47ce4ac649e0faf9792df7cdd0))
* **web:** serve an accessible server-rendered principles page ([57e9323](https://github.com/rcasia/engineer-principles-analyzer/commit/57e9323ab0386b718c2e79a56e948d098c7c96e7))
