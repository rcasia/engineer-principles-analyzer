## [1.18.2](https://github.com/rcasia/principled/compare/v1.18.1...v1.18.2) (2026-09-23)


### Bug Fixes

* **ci:** cache Stryker report whenever the run refreshes it ([b10841f](https://github.com/rcasia/principled/commit/b10841f09ead7ec270597a06ebee366c598f9e87))

## [1.18.1](https://github.com/rcasia/principled/compare/v1.18.0...v1.18.1) (2026-09-23)


### Bug Fixes

* **ci:** save Stryker cache on success only ([21ed35f](https://github.com/rcasia/principled/commit/21ed35f2c9b0b5ca293984ecc3e332c3e86dc215))

# [1.18.0](https://github.com/rcasia/principled/compare/v1.17.2...v1.18.0) (2026-09-23)


### Features

* **core:** run unknown languages as unknown instead of blocking ([b88cc96](https://github.com/rcasia/principled/commit/b88cc96ed27451d1205247e97f62882cf6326961))

## [1.17.2](https://github.com/rcasia/principled/compare/v1.17.1...v1.17.2) (2026-09-20)


### Bug Fixes

* **ci:** build the client before the Lambda bundle on deploy ([05fb4d5](https://github.com/rcasia/principled/commit/05fb4d56a145b1cc40aceca545c241d64501842f))

## [1.17.1](https://github.com/rcasia/principled/compare/v1.17.0...v1.17.1) (2026-09-20)


### Bug Fixes

* **ci:** queue mutation runs instead of cancelling them ([5273c6c](https://github.com/rcasia/principled/commit/5273c6cc4c247bbec30dfe0acbf031a0f299f756))

# [1.17.0](https://github.com/rcasia/principled/compare/v1.16.0...v1.17.0) (2026-09-20)


### Bug Fixes

* **ci:** build the client before the Lambda bundle ([874c33a](https://github.com/rcasia/principled/commit/874c33a60af902a636f34da7837d6b8cb538b507))
* **ci:** install detect-secrets in release jobs ([a284293](https://github.com/rcasia/principled/commit/a284293787a5ad1e4090a34a208db278b249fb54))
* **ci:** let the mutation score step continue on error ([0ca3c8d](https://github.com/rcasia/principled/commit/0ca3c8de3d76c4ee81e1dcbd268a825fd01fbfc4))
* **ci:** run forced full mutation without the incremental writer ([3386459](https://github.com/rcasia/principled/commit/3386459aba65664aab9038ae36acc54b6d97b3e7))
* **ci:** run mutation standalone, never blocking delivery ([0d89f51](https://github.com/rcasia/principled/commit/0d89f51cf90eb0ba173f41629885d37196a80d5b))


### Features

* **ci:** block new secrets with detect-secrets hook ([f7d46a5](https://github.com/rcasia/principled/commit/f7d46a58eadbfa9489ba41a6df423597ee7e0df3))
* **ci:** cover analyze in the cli-package gate ([df846a1](https://github.com/rcasia/principled/commit/df846a1ae155097839a6d3eba197ad56d6d986dc))
* **ci:** run Principled on pull requests with SARIF upload ([aafdac1](https://github.com/rcasia/principled/commit/aafdac16cd637ba0c4a7330b8e1dae31e58cd501)), closes [#25](https://github.com/rcasia/principled/issues/25)
* **cli:** analyze a file locally with versioned JSON and SARIF output ([a660694](https://github.com/rcasia/principled/commit/a660694e646a511d66fd21dea24653f12d87e2d0)), closes [#19](https://github.com/rcasia/principled/issues/19)
* **core:** add architecture dependency rules with project evaluation ([59839b5](https://github.com/rcasia/principled/commit/59839b5ca22e8eb76e5d3bcc45cb9b4cb5425be9)), closes [#23](https://github.com/rcasia/principled/issues/23)
* **core:** add custom rules and rulesets with versioned evaluation ([a51a7ce](https://github.com/rcasia/principled/commit/a51a7ce50fd7d34db360d1feec7c1d3332b79128)), closes [#24](https://github.com/rcasia/principled/issues/24)
* **core:** add finding lifecycle with event-sourced transitions ([5eb8398](https://github.com/rcasia/principled/commit/5eb8398754247cee5997f9283e1c1aa0a65ffa3a)), closes [#26](https://github.com/rcasia/principled/issues/26)
* **core:** add project analysis use case with events and projection ([df41089](https://github.com/rcasia/principled/commit/df4108958254334529ad80831fdb77d6d512938a)), closes [#22](https://github.com/rcasia/principled/issues/22)
* **core:** add project model with dependency graph and metrics ([0088681](https://github.com/rcasia/principled/commit/00886816030d2befa7d57ec47d39ad55ad8c6031)), closes [#22](https://github.com/rcasia/principled/issues/22)
* **core:** aggregate privacy-safe web product metrics ([8ed2d18](https://github.com/rcasia/principled/commit/8ed2d181160210ef44cdefec6027694275b8efd6)), closes [#28](https://github.com/rcasia/principled/issues/28)
* **core:** ask Jev Choice questions through the client port ([091210b](https://github.com/rcasia/principled/commit/091210b11468641e8b4d4ef83b0f2c4ac205ce54))
* **core:** detect Dependency Inversion violations with DipRule ([d1a0f4e](https://github.com/rcasia/principled/commit/d1a0f4eb0c0e553a62faeb8f80ffc7706a773fb6)), closes [#14](https://github.com/rcasia/principled/issues/14) [hi#level](https://github.com/hi/issues/level) [#8](https://github.com/rcasia/principled/issues/8) [#9](https://github.com/rcasia/principled/issues/9) [#28](https://github.com/rcasia/principled/issues/28) [#27](https://github.com/rcasia/principled/issues/27) [#30](https://github.com/rcasia/principled/issues/30) [#14](https://github.com/rcasia/principled/issues/14)
* **core:** detect Interface Segregation violations with IspRule ([ef72e80](https://github.com/rcasia/principled/commit/ef72e80c07ee33533d7d1880c63bbf87844e14dc)), closes [#13](https://github.com/rcasia/principled/issues/13) [#8](https://github.com/rcasia/principled/issues/8) [#9](https://github.com/rcasia/principled/issues/9) [#28](https://github.com/rcasia/principled/issues/28) [#27](https://github.com/rcasia/principled/issues/27) [#30](https://github.com/rcasia/principled/issues/30) [#13](https://github.com/rcasia/principled/issues/13)
* **core:** detect Liskov violations with LspRule ([f3f0378](https://github.com/rcasia/principled/commit/f3f037866e7e03c68e003212b5e5719a3062c696)), closes [#12](https://github.com/rcasia/principled/issues/12) [#8](https://github.com/rcasia/principled/issues/8) [#9](https://github.com/rcasia/principled/issues/9) [#28](https://github.com/rcasia/principled/issues/28) [#27](https://github.com/rcasia/principled/issues/27) [#30](https://github.com/rcasia/principled/issues/30) [#12](https://github.com/rcasia/principled/issues/12)
* **core:** detect Open/Closed violations with OcpRule ([0c94bb4](https://github.com/rcasia/principled/commit/0c94bb46d3e8b82422529d639d4f85d3a1d0829a)), closes [#11](https://github.com/rcasia/principled/issues/11) [#8](https://github.com/rcasia/principled/issues/8) [#9](https://github.com/rcasia/principled/issues/9) [#28](https://github.com/rcasia/principled/issues/28) [#27](https://github.com/rcasia/principled/issues/27) [#30](https://github.com/rcasia/principled/issues/30) [#11](https://github.com/rcasia/principled/issues/11)
* **core:** detect submission language with Jev Choice ([0c8c784](https://github.com/rcasia/principled/commit/0c8c7843f33cad7afd148957b23d21de0e66521e))
* **core:** guard telemetry payloads against sensitive keys ([e887d4b](https://github.com/rcasia/principled/commit/e887d4b11b54f4fb52d12043b11fdf458bdd8817))
* **core:** judge the SOLID rules against a versioned synthetic corpus ([a192b56](https://github.com/rcasia/principled/commit/a192b56cedf49bb2398866b12af9443f522c1ad3)), closes [#27](https://github.com/rcasia/principled/issues/27) [#28](https://github.com/rcasia/principled/issues/28) [#9](https://github.com/rcasia/principled/issues/9) [#30](https://github.com/rcasia/principled/issues/30) [#30](https://github.com/rcasia/principled/issues/30) [#27](https://github.com/rcasia/principled/issues/27)
* **core:** publish opt-in public code exemplars ([1a022bb](https://github.com/rcasia/principled/commit/1a022bbdecab46ec1876abb63b28f1e395101ac6)), closes [#32](https://github.com/rcasia/principled/issues/32)
* **core:** publish versioned evaluation snapshots per rule ([209f3cc](https://github.com/rcasia/principled/commit/209f3ccec6eddd980aebb5413fa7adfbe856fabf)), closes [#30](https://github.com/rcasia/principled/issues/30)
* **core:** remediate uncertain SRP findings with hedged guidance ([14e13cd](https://github.com/rcasia/principled/commit/14e13cd3ab7c1e39a3cceeb5db0d3e1db67c897d)), closes [#21](https://github.com/rcasia/principled/issues/21) [#37](https://github.com/rcasia/principled/issues/37)
* **core:** support java and python in the SRP heuristic ([b75d8b2](https://github.com/rcasia/principled/commit/b75d8b2276bb720708a3299e6adec9d44a151edd)), closes [#16](https://github.com/rcasia/principled/issues/16)

# [1.16.0](https://github.com/rcasia/principled/compare/v1.15.0...v1.16.0) (2026-09-20)


### Bug Fixes

* **ci:** move cache and artifact actions to Node 24 runtimes ([63b1943](https://github.com/rcasia/principled/commit/63b19439a35588318844c0f4599d975abec95c99))
* **ci:** remove duplicated then in mutation guard ([57fc1c4](https://github.com/rcasia/principled/commit/57fc1c4c3f62336f76a9884355799ad92d64da28))


### Features

* **core:** detect programming language from filename and content ([775f520](https://github.com/rcasia/principled/commit/775f520f49d7d6bb83461a89609c7ec7785a4378))
* **core:** probe SRP with a Jev-backed Rule adapter to validate the core ([e4790f5](https://github.com/rcasia/principled/commit/e4790f525478cafd9718f95381de98413e72d985))

# [1.15.0](https://github.com/rcasia/principled/compare/v1.14.0...v1.15.0) (2026-09-19)


### Features

* **core:** detect Single Responsibility violations with SrpRule ([5277219](https://github.com/rcasia/principled/commit/5277219580fd2cbc200155a1f1b99accf06e34b0)), closes [#10](https://github.com/rcasia/principled/issues/10) [#8](https://github.com/rcasia/principled/issues/8) [#9](https://github.com/rcasia/principled/issues/9) [#28](https://github.com/rcasia/principled/issues/28) [#27](https://github.com/rcasia/principled/issues/27) [#30](https://github.com/rcasia/principled/issues/30) [#10](https://github.com/rcasia/principled/issues/10)


### Performance Improvements

* **ci:** reuse Stryker incremental results via the Actions cache ([8ad2516](https://github.com/rcasia/principled/commit/8ad25164e4dd76e3e963584557a5ce4c0c18b144))


### Reverts

* **ci:** restore blocking dependency audit gate ([e4e1839](https://github.com/rcasia/principled/commit/e4e1839632ceea80ff6cb032e41166fe21234284)), closes [#48](https://github.com/rcasia/principled/issues/48)

# [1.14.0](https://github.com/rcasia/principled/compare/v1.13.0...v1.14.0) (2026-09-19)


### Features

* **ci:** run the cli and web release trains in parallel ([75e9f2b](https://github.com/rcasia/principled/commit/75e9f2bc18844fe696ff7e00ac9f5d80cf1e0598))

# [1.13.0](https://github.com/rcasia/principled/compare/v1.12.1...v1.13.0) (2026-09-19)


### Features

* **release:** route release trains by changed files ([3444019](https://github.com/rcasia/principled/commit/3444019ed4b02b9f0c93e55961d7585c46ed8cf9))

## [1.12.1](https://github.com/rcasia/principled/compare/v1.12.0...v1.12.1) (2026-09-19)


### Bug Fixes

* **ci:** check out main's current tip in release-web and deploy ([42634aa](https://github.com/rcasia/principled/commit/42634aa7e89cd08ba4a7b34c71c0e78417fbb2aa))
* **ci:** don't let bun audit's outage block the pipeline ([eab51de](https://github.com/rcasia/principled/commit/eab51de2252468cfb8702378f9084e2ba35db769)), closes [#48](https://github.com/rcasia/principled/issues/48)

# [1.12.0](https://github.com/rcasia/principled/compare/v1.11.1...v1.12.0) (2026-09-19)


### Features

* **release:** split the cli and web release trains by commit scope ([9c2f4b9](https://github.com/rcasia/principled/commit/9c2f4b950ecb44bf7e2f9ec1a92581459eb59b23))

## [1.11.1](https://github.com/rcasia/principled/compare/v1.11.0...v1.11.1) (2026-09-19)


### Bug Fixes

* **infra:** allow POST through CloudFront so /analyze works in prod ([b15393c](https://github.com/rcasia/principled/commit/b15393c15fc9c1f7f9b51e0d9f59b4fb29967337)), closes [#34](https://github.com/rcasia/principled/issues/34)

# [1.11.0](https://github.com/rcasia/principled/compare/v1.10.0...v1.11.0) (2026-09-19)


### Features

* **web:** analyze a single source file on the web ([d3d9fc0](https://github.com/rcasia/principled/commit/d3d9fc0106c636a5fc58c473dca160e2cc52a60b)), closes [#34](https://github.com/rcasia/principled/issues/34) [10-#14](https://github.com/10-/issues/14)

# [1.10.0](https://github.com/rcasia/principled/compare/v1.9.0...v1.10.0) (2026-09-19)


### Features

* **core:** add analysis run read model for event replay ([4b49a6b](https://github.com/rcasia/principled/commit/4b49a6b39dd6b51edc11c49affe3e93b2674b8ec)), closes [#9](https://github.com/rcasia/principled/issues/9) [#34](https://github.com/rcasia/principled/issues/34)

# [1.9.0](https://github.com/rcasia/principled/compare/v1.8.0...v1.9.0) (2026-09-19)


### Features

* **core:** build the rule evaluation engine ([c1f8ab8](https://github.com/rcasia/principled/commit/c1f8ab8bfd0ef30790750aa343692b2d96b6307a)), closes [#9](https://github.com/rcasia/principled/issues/9) [#8](https://github.com/rcasia/principled/issues/8) [#33](https://github.com/rcasia/principled/issues/33)

# [1.8.0](https://github.com/rcasia/principled/compare/v1.7.0...v1.8.0) (2026-09-19)


### Features

* **core:** define analysis result contract ([08ef528](https://github.com/rcasia/principled/commit/08ef528428454c12cdc26bdd874b7abe51a812a4)), closes [#9](https://github.com/rcasia/principled/issues/9) [#8](https://github.com/rcasia/principled/issues/8)

# [1.7.0](https://github.com/rcasia/principled/compare/v1.6.1...v1.7.0) (2026-09-19)


### Features

* **core:** add event sourcing and CQRS foundation ([3402b44](https://github.com/rcasia/principled/commit/3402b4453f2bc0661b5bfe4b3246065262f1df53)), closes [#34](https://github.com/rcasia/principled/issues/34) [#34](https://github.com/rcasia/principled/issues/34) [#33](https://github.com/rcasia/principled/issues/33) [#34](https://github.com/rcasia/principled/issues/34)

## [1.6.1](https://github.com/rcasia/principled/compare/v1.6.0...v1.6.1) (2026-09-19)

# [1.6.0](https://github.com/rcasia/principled/compare/v1.5.1...v1.6.0) (2026-09-19)


### Bug Fixes

* **deps:** override qs to a version without known advisories ([94e7656](https://github.com/rcasia/principled/commit/94e7656b3b0da6d29295b90822f8448423f0f568))


### Features

* **ci:** gate on bun audit at commit time, in CI, and weekly ([d985ad5](https://github.com/rcasia/principled/commit/d985ad5cb8f0855dfefb35e567bfbf6ee7bf92c1))

## [1.5.1](https://github.com/rcasia/principled/compare/v1.5.0...v1.5.1) (2026-09-19)


### Bug Fixes

* **cli:** point repository links at the renamed github repo ([8d85dcc](https://github.com/rcasia/principled/commit/8d85dcc0eaacedad7659907c84fa6cf8cf7e3db3))
* **web:** show Principled in the page title and heading ([c7d2dac](https://github.com/rcasia/principled/commit/c7d2dacd41932f00eafc32d9ce1563c280291e4c))

# [1.5.0](https://github.com/rcasia/engineer-principles-analyzer/compare/v1.4.0...v1.5.0) (2026-09-19)


### Features

* **web:** establish product design foundation ([085e11c](https://github.com/rcasia/engineer-principles-analyzer/commit/085e11cef7a4175fb1e5821e31052a9a7319dd47))

# [1.4.0](https://github.com/rcasia/engineer-principles-analyzer/compare/v1.3.2...v1.4.0) (2026-09-19)


### Features

* **cli:** prefer npm oidc trusted publishing over a long-lived token ([c9c7c6b](https://github.com/rcasia/engineer-principles-analyzer/commit/c9c7c6bb79202316435d94a20e5220221004ab34))

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
