export type UiLocale = "en" | "ru";

export type UiTextKey =
  | "adminPanel.broadcastFailed"
  | "adminPanel.broadcastMissingFields"
  | "adminPanel.broadcastSent"
  | "adminPanel.category.countries"
  | "adminPanel.category.notifications"
  | "adminPanel.category.population"
  | "adminPanel.category.provinces"
  | "adminPanel.countryDeleted"
  | "adminPanel.countryDeleteFailed"
  | "adminPanel.countryDeleteSelfFailed"
  | "adminPanel.countryHasNoRegions"
  | "adminPanel.countryUpdated"
  | "adminPanel.countryUpdateFailed"
  | "adminPanel.deleteCountryConfirm"
  | "adminPanel.ignoreUpdated"
  | "adminPanel.ignoreUpdateFailed"
  | "adminPanel.populationCleared"
  | "adminPanel.populationClearFailed"
  | "adminPanel.populationGenerated"
  | "adminPanel.populationGenerateFailed"
  | "adminPanel.populationJsonInvalid"
  | "adminPanel.punishmentStatus.ignoredUntilTurn"
  | "adminPanel.punishmentStatus.none"
  | "adminPanel.punishmentStatus.permanent"
  | "adminPanel.punishmentStatus.untilTime"
  | "adminPanel.punishmentStatus.untilTurn"
  | "adminPanel.punishmentUpdated"
  | "adminPanel.punishmentUpdateFailed"
  | "adminPanel.regionCostReset"
  | "adminPanel.regionCostResetFailed"
  | "adminPanel.regionPopulationUpdated"
  | "adminPanel.regionPopulationUpdateFailed"
  | "adminPanel.regionUpdated"
  | "adminPanel.regionUpdateFailed"
  | "adminPanel.selectCountry"
  | "adminPanel.selectRegion"
  | "common.cancel"
  | "common.close"
  | "common.confirm"
  | "common.pending"
  | "common.refresh"
  | "common.save"
  | "common.saving"
  | "commandPalette.action.budget"
  | "commandPalette.action.province"
  | "commandPalette.action.resolve"
  | "commandPalette.action.routes"
  | "commandPalette.action.politics"
  | "commandPalette.actions"
  | "commandPalette.empty"
  | "commandPalette.placeholder"
  | "customSelect.noOptions"
  | "customSelect.placeholder"
  | "countryEvents.choiceRequired"
  | "countryEvents.defaultEvent"
  | "countryEvents.effectFallback"
  | "countryEvents.empty"
  | "countryEvents.emptyDescription"
  | "countryEvents.historyEmpty"
  | "countryEvents.historyEmptyDescription"
  | "countryEvents.historyMeta"
  | "countryEvents.important"
  | "countryEvents.importantPending"
  | "countryEvents.loadFailed"
  | "countryEvents.loading"
  | "countryEvents.loadingDescription"
  | "countryEvents.notificationLoadingDescription"
  | "countryEvents.optionFailed"
  | "countryEvents.processed"
  | "countryEvents.storySubtitle"
  | "countryEvents.title"
  | "customization.afterPurchase"
  | "customization.applied"
  | "customization.applyFailed"
  | "customization.availableDucats"
  | "customization.buyAndApply"
  | "customization.changeColor"
  | "customization.changeCrest"
  | "customization.changeFlag"
  | "customization.costTitle"
  | "customization.crestPreviewAlt"
  | "customization.currentCrestAlt"
  | "customization.currentFlagAlt"
  | "customization.flagPreviewAlt"
  | "customization.insufficientDucats"
  | "customization.loadingPrices"
  | "customization.loadPricesFailed"
  | "customization.noChanges"
  | "customization.notEnoughDucats"
  | "customization.notSelected"
  | "customization.rename"
  | "customization.saving"
  | "customization.total"
  | "eventLog.category"
  | "eventLog.categories"
  | "eventLog.clear"
  | "eventLog.collapse"
  | "eventLog.countTooltip"
  | "eventLog.countryFilter"
  | "eventLog.countryScope"
  | "eventLog.countryTooltip"
  | "eventLog.duplicateCount"
  | "eventLog.empty"
  | "eventLog.expand"
  | "eventLog.expandMessage"
  | "eventLog.groupDuplicatesOff"
  | "eventLog.groupDuplicatesOn"
  | "eventLog.groupDuplicatesTooltip"
  | "eventLog.hideMessage"
  | "eventLog.priority"
  | "eventLog.priorityHigh"
  | "eventLog.priorityLow"
  | "eventLog.priorityMedium"
  | "eventLog.priorityTooltip"
  | "eventLog.privateTooltip"
  | "eventLog.scope.all"
  | "eventLog.scope.foreign"
  | "eventLog.scope.own"
  | "eventLog.scopeTooltip"
  | "eventLog.sortPriority"
  | "eventLog.sortTime"
  | "eventLog.systemAlwaysVisible"
  | "eventLog.title"
  | "eventLog.trimOld"
  | "eventLog.turn"
  | "eventLog.turnTooltip"
  | "gameSettings.applyScenarioConfirm"
  | "gameSettings.autoCostsRecalculated"
  | "gameSettings.autoCostsRecalculateFailed"
  | "gameSettings.backgroundCleared"
  | "gameSettings.backgroundClearFailed"
  | "gameSettings.backgroundCurrent"
  | "gameSettings.backgroundDelete"
  | "gameSettings.backgroundEmpty"
  | "gameSettings.backgroundSaved"
  | "gameSettings.backgroundSaveFailed"
  | "gameSettings.backgroundSelectFirst"
  | "gameSettings.backgroundTitle"
  | "gameSettings.backgroundTooLarge"
  | "gameSettings.backgroundUpload"
  | "gameSettings.category.background"
  | "gameSettings.category.colonization"
  | "gameSettings.category.customization"
  | "gameSettings.category.economy"
  | "gameSettings.category.eventLog"
  | "gameSettings.category.registration"
  | "gameSettings.category.resourceIcons"
  | "gameSettings.category.scenarios"
  | "gameSettings.category.turnTimer"
  | "gameSettings.chooseFile"
  | "gameSettings.chooseImage"
  | "gameSettings.colonization.costNote"
  | "gameSettings.colonization.ducatsCost"
  | "gameSettings.colonization.maxActive"
  | "gameSettings.colonization.pointsCost"
  | "gameSettings.colonization.pointsPerTurn"
  | "gameSettings.colonization.settlersDescription"
  | "gameSettings.colonization.settlersDisable"
  | "gameSettings.colonization.settlersEnable"
  | "gameSettings.colonization.settlersEnabled"
  | "gameSettings.colonization.settlersOnCapture"
  | "gameSettings.colonizationSaved"
  | "gameSettings.colonizationSaveFailed"
  | "gameSettings.colonizationTitle"
  | "gameSettings.customization.crest"
  | "gameSettings.customization.flag"
  | "gameSettings.customization.recolor"
  | "gameSettings.customization.renameCountry"
  | "gameSettings.customization.renameProvince"
  | "gameSettings.customizationSaved"
  | "gameSettings.customizationSaveFailed"
  | "gameSettings.customizationTitle"
  | "gameSettings.economy.constructionPerTurn"
  | "gameSettings.economy.culturePerTurn"
  | "gameSettings.economy.demolitionCost"
  | "gameSettings.economy.ducatsPerTurn"
  | "gameSettings.economy.durabilityDecay"
  | "gameSettings.economy.durabilityRecovery"
  | "gameSettings.economy.explorationDepletion"
  | "gameSettings.economy.explorationDuration"
  | "gameSettings.economy.explorationEmptyChance"
  | "gameSettings.economy.explorationRolls"
  | "gameSettings.economy.goldPerTurn"
  | "gameSettings.economy.marketSmoothing"
  | "gameSettings.economy.pollutionEffect"
  | "gameSettings.economy.religionPerTurn"
  | "gameSettings.economy.sciencePerTurn"
  | "gameSettings.economySaved"
  | "gameSettings.economySaveFailed"
  | "gameSettings.economyTitle"
  | "gameSettings.eventLogRetention"
  | "gameSettings.eventLogSaved"
  | "gameSettings.eventLogSaveFailed"
  | "gameSettings.eventLogTitle"
  | "gameSettings.fileSelected"
  | "gameSettings.loadFailed"
  | "gameSettings.loading"
  | "gameSettings.map.hideAntarctica"
  | "gameSettings.map.showAntarctica"
  | "gameSettings.map.showAntarcticaAction"
  | "gameSettings.map.showAntarcticaDescription"
  | "gameSettings.no"
  | "gameSettings.recalculateAutoCosts"
  | "gameSettings.registrationApprovalDisable"
  | "gameSettings.registrationApprovalEnable"
  | "gameSettings.registrationRequireApproval"
  | "gameSettings.registrationRequireApprovalDescription"
  | "gameSettings.registrationSaved"
  | "gameSettings.registrationSaveFailed"
  | "gameSettings.registrationTitle"
  | "gameSettings.resource.population"
  | "gameSettings.resourceIconEmpty"
  | "gameSettings.resourceIconSelectFirst"
  | "gameSettings.resourceIconsSaved"
  | "gameSettings.resourceIconsSaveFailed"
  | "gameSettings.resourceIconsTitle"
  | "gameSettings.resourceIconsUpload"
  | "gameSettings.resourceIconTooLarge"
  | "gameSettings.resourceIconTooLargeFor"
  | "gameSettings.scenarioActive"
  | "gameSettings.scenarioApplied"
  | "gameSettings.scenarioAppliedDescription"
  | "gameSettings.scenarioApplyFailed"
  | "gameSettings.scenarioFiles"
  | "gameSettings.scenarioMap"
  | "gameSettings.scenarioMvt"
  | "gameSettings.scenarioRaster"
  | "gameSettings.scenariosDescription"
  | "gameSettings.scenarioSelected"
  | "gameSettings.scenariosEmpty"
  | "gameSettings.scenariosLoadFailed"
  | "gameSettings.scenariosLoading"
  | "gameSettings.scenarioStart"
  | "gameSettings.scenarioStarting"
  | "gameSettings.scenarioStartTurn"
  | "gameSettings.scenariosTitle"
  | "gameSettings.title"
  | "gameSettings.turnTimerDisable"
  | "gameSettings.turnTimerEnable"
  | "gameSettings.turnTimerEnabled"
  | "gameSettings.turnTimerEnabledDescription"
  | "gameSettings.turnTimerPauseDisable"
  | "gameSettings.turnTimerPauseEnable"
  | "gameSettings.turnTimerPauseOffline"
  | "gameSettings.turnTimerPauseOfflineDescription"
  | "gameSettings.turnTimerRange"
  | "gameSettings.turnTimerSaved"
  | "gameSettings.turnTimerSaveFailed"
  | "gameSettings.turnTimerSeconds"
  | "gameSettings.turnTimerTitle"
  | "gameSettings.yes"
  | "auth.accountLockedPermanent"
  | "auth.accountLockedTime"
  | "auth.accountLockedTurn"
  | "auth.chooseCountry"
  | "auth.clientVersion"
  | "auth.country"
  | "auth.countryColor"
  | "auth.countryCreated"
  | "auth.countryName"
  | "auth.createCountry"
  | "auth.creating"
  | "auth.crest"
  | "auth.crestHint"
  | "auth.crestInvalid"
  | "auth.crestPreview"
  | "auth.enterGame"
  | "auth.enterPassword"
  | "auth.fileTooLarge"
  | "auth.flag"
  | "auth.flagHint"
  | "auth.flagInvalid"
  | "auth.flagPreview"
  | "auth.imageFormatInvalid"
  | "auth.invalidHex"
  | "auth.invalidPassword"
  | "auth.knowledge"
  | "auth.loadingGame"
  | "auth.lockReason"
  | "auth.login"
  | "auth.loginPending"
  | "auth.loginSuccess"
  | "auth.min2"
  | "auth.min8"
  | "auth.noFileSelected"
  | "auth.onlyImages"
  | "auth.password"
  | "auth.passwordComplexityAria"
  | "auth.passwordComplexityLoginNeed"
  | "auth.passwordComplexityNeed"
  | "auth.passwordComplexityOk"
  | "auth.passwordLengthAria"
  | "auth.passwordLengthNeed"
  | "auth.passwordLengthOk"
  | "auth.passwordMismatch"
  | "auth.presetColor"
  | "auth.register"
  | "auth.registrationError"
  | "auth.registrationPendingApproval"
  | "auth.registrationPendingDescription"
  | "auth.registrationSent"
  | "auth.registrationSentMessage"
  | "auth.rememberMe"
  | "auth.repeatPassword"
  | "auth.selectCountry"
  | "auth.selectImage"
  | "auth.serverStatus.maintenance"
  | "auth.serverStatus.offline"
  | "auth.serverStatus.online"
  | "auth.serverUnavailable"
  | "auth.waitButton"
  | "clientSettings.description"
  | "clientSettings.descriptionTitle"
  | "clientSettings.interface"
  | "clientSettings.language"
  | "clientSettings.languageDescription"
  | "clientSettings.localNote"
  | "clientSettings.mapControls"
  | "clientSettings.mapControlsDescription"
  | "clientSettings.save"
  | "clientSettings.sortNotifications"
  | "clientSettings.sortNotificationsDescription"
  | "clientSettings.title"
  | "clientSettings.uiLanguage"
  | "civilopedia.admin.addCategory"
  | "civilopedia.admin.articleEditor"
  | "civilopedia.admin.articleImage"
  | "civilopedia.admin.articleImageHint"
  | "civilopedia.admin.category"
  | "civilopedia.admin.categoryExistsDescription"
  | "civilopedia.admin.categoryExistsTitle"
  | "civilopedia.admin.categoryInputPlaceholder"
  | "civilopedia.admin.categoryManualPlaceholder"
  | "civilopedia.admin.categoryTitle"
  | "civilopedia.admin.copiedToken"
  | "civilopedia.admin.defaultArticleTitle"
  | "civilopedia.admin.defaultSectionTitle"
  | "civilopedia.admin.deleteCategory"
  | "civilopedia.admin.description"
  | "civilopedia.admin.emptyEditor"
  | "civilopedia.admin.inlineHint"
  | "civilopedia.admin.inlineImage"
  | "civilopedia.admin.inlineImageDescription"
  | "civilopedia.admin.inlineImageLimit"
  | "civilopedia.admin.inlineUpload"
  | "civilopedia.admin.keywords"
  | "civilopedia.admin.noImage"
  | "civilopedia.admin.provinceArticleMissing"
  | "civilopedia.admin.provinceCategory"
  | "civilopedia.admin.provinceDefaultBody"
  | "civilopedia.admin.provinceDefaultSummary"
  | "civilopedia.admin.provinceDefaultTitle"
  | "civilopedia.admin.provinceIdLine"
  | "civilopedia.admin.relatedCsv"
  | "civilopedia.admin.removeCategoryBlocked"
  | "civilopedia.admin.removeCategoryBlockedDescription"
  | "civilopedia.admin.saveArticle"
  | "civilopedia.admin.saved"
  | "civilopedia.admin.saveFailed"
  | "civilopedia.admin.sectionFormatHint"
  | "civilopedia.admin.sectionsJson"
  | "civilopedia.admin.title"
  | "civilopedia.admin.untitled"
  | "civilopedia.admin.upload"
  | "civilopedia.admin.uploadedImage"
  | "civilopedia.admin.uploadImageFailed"
  | "civilopedia.admin.uploadedInlineImage"
  | "civilopedia.admin.uploadInlineImageFailed"
  | "civilopedia.admin.uploadInlineImageHint"
  | "civilopedia.admin.urlPlaceholder"
  | "civilopedia.category.basics"
  | "civilopedia.category.colonization"
  | "civilopedia.category.economy"
  | "civilopedia.category.journal"
  | "civilopedia.category.map"
  | "civilopedia.category.other"
  | "civilopedia.category.turns"
  | "civilopedia.description"
  | "civilopedia.edit"
  | "civilopedia.editMode"
  | "civilopedia.emptySelection"
  | "civilopedia.loading"
  | "civilopedia.loadFailed"
  | "civilopedia.newArticle"
  | "civilopedia.noResults"
  | "civilopedia.related"
  | "civilopedia.searchPlaceholder"
  | "civilopedia.title"
  | "decisions.available"
  | "decisions.category.colonization"
  | "decisions.category.culture"
  | "decisions.category.diplomacy"
  | "decisions.category.economy"
  | "decisions.category.military"
  | "decisions.category.politics"
  | "decisions.category.religion"
  | "decisions.category.technology"
  | "decisions.cost"
  | "decisions.effectFallback"
  | "decisions.effects"
  | "decisions.emptyAvailable"
  | "decisions.emptyLocked"
  | "decisions.emptyTitle"
  | "decisions.history"
  | "decisions.historyEmpty"
  | "decisions.historyEmptyDescription"
  | "decisions.loadFailed"
  | "decisions.loading"
  | "decisions.loadingDescription"
  | "decisions.locked"
  | "decisions.notAvailable"
  | "decisions.none"
  | "decisions.open"
  | "decisions.resource.colonization"
  | "decisions.resource.construction"
  | "decisions.resource.culture"
  | "decisions.resource.ducats"
  | "decisions.resource.gold"
  | "decisions.resource.religion"
  | "decisions.resource.science"
  | "decisions.storySubtitle"
  | "decisions.take"
  | "decisions.taken"
  | "decisions.takeFailed"
  | "decisions.title"
  | "decisions.turn"
  | "elections.distribution"
  | "elections.distributionDescription"
  | "elections.empty"
  | "elections.government"
  | "elections.noPartySeats"
  | "elections.parties"
  | "elections.parliamentDescription"
  | "elections.seatShare"
  | "elections.seats"
  | "elections.subtitle"
  | "elections.title"
  | "elections.tooltipVotes"
  | "elections.voteShare"
  | "army.air"
  | "army.attack"
  | "army.baseProvince"
  | "army.battleSlots"
  | "army.branchTemplates"
  | "army.cancel"
  | "army.composition"
  | "army.createFormation"
  | "army.defaultAir"
  | "army.defaultLand"
  | "army.defaultNaval"
  | "army.delete"
  | "army.defense"
  | "army.description"
  | "army.disbandDivision"
  | "army.emptyQueue"
  | "army.emptyQueueDescription"
  | "army.form"
  | "army.formation"
  | "army.formationQueue"
  | "army.formationSpeed"
  | "army.icon64"
  | "army.iconInvalid64"
  | "army.iconUploadFailed"
  | "army.land"
  | "army.location"
  | "army.loading"
  | "army.loadingDescription"
  | "army.march"
  | "army.manpowerShort"
  | "army.moveActive"
  | "army.moveCancel"
  | "army.movePickDestination"
  | "army.naval"
  | "army.newTemplate"
  | "army.noData"
  | "army.noDataDescription"
  | "army.noReadyUnits"
  | "army.noReadyUnitsDescription"
  | "army.organizationShort"
  | "army.queue"
  | "army.readyUnits"
  | "army.saveTemplate"
  | "army.strengthShort"
  | "army.support"
  | "army.supplyShort"
  | "army.totalBattalions"
  | "army.totalSoldiers"
  | "army.templateDeleted"
  | "army.templateName"
  | "army.unknownBattalion"
  | "army.unknownTemplate"
  | "army.title"
  | "army.unitName"
  | "locale.english"
  | "locale.russian"
  | "map.controls.zoomIn"
  | "map.controls.zoomOut"
  | "map.controls.resetView"
  | "map.controls.lockInteraction"
  | "map.controls.unlockInteraction"
  | "map.mode.regions.label"
  | "map.mode.regions.shortLabel"
  | "map.mode.regions.legendLabel"
  | "map.mode.regions.legendDescription"
  | "map.mode.provinceColors.label"
  | "map.mode.provinceColors.shortLabel"
  | "map.mode.provinceColors.legendLabel"
  | "map.mode.provinceColors.legendDescription"
  | "modifiers.activeCount"
  | "modifiers.column.effect"
  | "modifiers.column.modifier"
  | "modifiers.column.mode"
  | "modifiers.column.scope"
  | "modifiers.column.source"
  | "modifiers.column.target"
  | "modifiers.column.value"
  | "modifiers.description"
  | "modifiers.empty"
  | "modifiers.loadFailed"
  | "modifiers.loading"
  | "modifiers.scope.building"
  | "modifiers.scope.country"
  | "modifiers.scope.market"
  | "modifiers.scope.pop"
  | "modifiers.scope.province"
  | "modifiers.source.event"
  | "modifiers.source.law"
  | "modifiers.source.modifier"
  | "modifiers.source.technology"
  | "modifiers.stat.building_construction_cost"
  | "modifiers.stat.building_input"
  | "modifiers.stat.building_output"
  | "modifiers.stat.building_throughput"
  | "modifiers.stat.building_wage"
  | "modifiers.stat.colonization_gain"
  | "modifiers.stat.construction_gain"
  | "modifiers.stat.culture_gain"
  | "modifiers.stat.ducats_gain"
  | "modifiers.stat.gold_gain"
  | "modifiers.stat.religion_gain"
  | "modifiers.stat.science_gain"
  | "modifiers.stat.technology_cost"
  | "modifiers.target.all"
  | "modifiers.target.building"
  | "modifiers.target.category"
  | "modifiers.target.good"
  | "modifiers.target.profession"
  | "modifiers.title"
  | "notifications.category.diplomacy"
  | "notifications.category.economy"
  | "notifications.category.politics"
  | "notifications.category.registration"
  | "notifications.category.system"
  | "notifications.delete"
  | "notifications.electionResults"
  | "notifications.emptyHistory"
  | "notifications.fallback.countryEvent"
  | "notifications.fallback.diplomacy"
  | "notifications.fallback.electionResults"
  | "notifications.fallback.generic"
  | "notifications.fallback.registration"
  | "politics.aboutSelectedLaw"
  | "politics.activePowerLaws"
  | "politics.billStarted"
  | "politics.billStartFailed"
  | "politics.billStatusDebating"
  | "politics.chartTooltip"
  | "politics.currentBills"
  | "politics.currentLimits"
  | "politics.defaultPower"
  | "politics.description"
  | "politics.discipline"
  | "politics.interestGroups"
  | "politics.lawAction.enact"
  | "politics.lawAction.vote"
  | "politics.lawAlreadyActive"
  | "politics.lawAlreadyInVote"
  | "politics.laws"
  | "politics.lawStatus.active"
  | "politics.lawStatus.inactive"
  | "politics.lawStatus.voting"
  | "politics.legend.abstain"
  | "politics.legend.oppose"
  | "politics.legend.partyColors"
  | "politics.legend.support"
  | "politics.limit.laws"
  | "politics.limit.lawsDirect"
  | "politics.limit.lawsVote"
  | "politics.limit.noRatification"
  | "politics.limit.noThreshold"
  | "politics.limit.ratificationRequired"
  | "politics.limit.transferThreshold"
  | "politics.limit.transfers"
  | "politics.limit.treaties"
  | "politics.loadFailed"
  | "politics.loading"
  | "politics.loyalists"
  | "politics.noCurrentBills"
  | "politics.noDescription"
  | "politics.noGroup"
  | "politics.noInterestGroups"
  | "politics.noLawGroups"
  | "politics.none"
  | "politics.parliament"
  | "politics.parliamentPowers"
  | "politics.party.government"
  | "politics.party.opposition"
  | "politics.partyLabel"
  | "politics.power.budget.approveBudget"
  | "politics.power.budget.approveTaxes"
  | "politics.power.budget.controlBudget"
  | "politics.power.diplomacy.ratifyAll"
  | "politics.power.diplomacy.ratifyMajorTreaties"
  | "politics.power.diplomacy.ratifyTerritory"
  | "politics.power.government.appointGovernment"
  | "politics.power.government.confidenceVote"
  | "politics.power.laws.advisory"
  | "politics.power.laws.approve"
  | "politics.power.laws.initiate"
  | "politics.power.none"
  | "politics.power.war.approve"
  | "politics.power.war.declare"
  | "politics.powerDescription.budgetDirect"
  | "politics.powerDescription.budgetVote"
  | "politics.powerDescription.diplomacyDirect"
  | "politics.powerDescription.diplomacyVote"
  | "politics.powerDescription.governmentDirect"
  | "politics.powerDescription.governmentVote"
  | "politics.powerDescription.lawsDirect"
  | "politics.powerDescription.lawsVote"
  | "politics.powerDescription.warDirect"
  | "politics.powerDescription.warVote"
  | "politics.powerDomain.budget"
  | "politics.powerDomain.diplomacy"
  | "politics.powerDomain.government"
  | "politics.powerDomain.laws"
  | "politics.powerDomain.war"
  | "politics.preference.against"
  | "politics.preference.for"
  | "politics.preference.neutral"
  | "politics.preference.opposes"
  | "politics.preference.supports"
  | "politics.radicals"
  | "politics.rawPower"
  | "politics.seatCount"
  | "politics.seatDistribution"
  | "politics.seats"
  | "politics.selectLaw"
  | "politics.selectedLaw"
  | "politics.selectedLawPreference"
  | "politics.selectLawForGroups"
  | "politics.tab.interestGroups"
  | "politics.tab.laws"
  | "politics.tab.overview"
  | "politics.tab.parties"
  | "politics.tab.powers"
  | "politics.title"
  | "politics.vote.abstainCompact"
  | "politics.vote.abstainShort"
  | "politics.vote.abstainValue"
  | "politics.vote.no"
  | "politics.vote.noCompact"
  | "politics.vote.noValue"
  | "politics.vote.yes"
  | "politics.vote.yesCompact"
  | "politics.vote.yesValue"
  | "politics.voteForecast"
  | "notifications.history"
  | "notifications.new"
  | "notifications.openHistory"
  | "notifications.openHistoryDescription"
  | "notifications.receivedTurn"
  | "notifications.registrationRequest"
  | "notifications.requiresDecision"
  | "notifications.total"
  | "notifications.viewed"
  | "provincePanel.collapse"
  | "provinceTooltip.area"
  | "provinceTooltip.colonization"
  | "provinceTooltip.owner"
  | "provincePanel.pin"
  | "provincePanel.unpin"
  | "corridorBuild.title"
  | "corridorBuild.summary"
  | "corridorBuild.undoPoint"
  | "colonization.title"
  | "colonization.fallbackRegion"
  | "colonization.area"
  | "colonization.showOwnColonies"
  | "colonization.selectRegion"
  | "colonization.cost"
  | "colonization.ducatsByArea"
  | "colonization.status"
  | "colonization.statusOccupied"
  | "colonization.statusDisabled"
  | "colonization.statusAvailable"
  | "colonization.regionArea"
  | "colonization.yourProgress"
  | "colonization.limitTooltip"
  | "colonization.limit"
  | "colonization.raceLeader"
  | "colonization.noParticipants"
  | "colonization.disabledByAdmin"
  | "colonization.participants"
  | "colonization.noColonizers"
  | "colonization.openAdminEditor"
  | "colonization.openAdminEditorAria"
  | "colonization.cancelTooltipCan"
  | "colonization.cancelTooltipCannot"
  | "colonization.cancel"
  | "colonization.startTooltipCan"
  | "colonization.startTooltipCannot"
  | "colonization.start"
  | "colonization.toastStarted"
  | "colonization.eventStartTitle"
  | "colonization.eventStartMessage"
  | "colonization.limitReached"
  | "colonization.eventLimitTitle"
  | "colonization.startFailed"
  | "colonization.toastCanceled"
  | "colonization.eventCancelTitle"
  | "colonization.eventCancelMessage"
  | "colonization.cancelFailed"
  | "diplomacy.transferRegion"
  | "diplomacy.transferRegionSummary"
  | "diplomacy.regionNotOwned"
  | "diplomacy.selectRegion"
  | "diplomacy.accept"
  | "diplomacy.activeTab"
  | "diplomacy.addClauseFromColumn"
  | "diplomacy.addTreatyClauses"
  | "diplomacy.articleSuffix"
  | "diplomacy.categoryEconomy"
  | "diplomacy.categoryInfrastructure"
  | "diplomacy.categoryOther"
  | "diplomacy.categoryTerritory"
  | "diplomacy.clauseConstructionRights"
  | "diplomacy.clauseOutsideParties"
  | "diplomacy.clauseTextNote"
  | "diplomacy.clauseTransferMoney"
  | "diplomacy.clauseTransit"
  | "diplomacy.constructionExpiration"
  | "diplomacy.countrySelect"
  | "diplomacy.createOrCheckOtherTab"
  | "diplomacy.declineRenewal"
  | "diplomacy.diplomaticAgreement"
  | "diplomacy.durationActive"
  | "diplomacy.durationLabel"
  | "diplomacy.edit"
  | "diplomacy.editingAgreement"
  | "diplomacy.emptyList"
  | "diplomacy.expiredRenewal"
  | "diplomacy.fillClauses"
  | "diplomacy.insufficientFunds"
  | "diplomacy.incomingTab"
  | "diplomacy.initiator"
  | "diplomacy.loadFailed"
  | "diplomacy.negotiationMeta"
  | "diplomacy.newAgreement"
  | "diplomacy.noResponder"
  | "diplomacy.ourArticles"
  | "diplomacy.ourConditions"
  | "diplomacy.outgoingTab"
  | "diplomacy.partyOurs"
  | "diplomacy.partyTheirs"
  | "diplomacy.paymentOnce"
  | "diplomacy.paymentPerTurn"
  | "diplomacy.policyDisableWithoutTransit"
  | "diplomacy.policyDisableWithoutTransitDescription"
  | "diplomacy.policyNationalize"
  | "diplomacy.policyNationalizeDescription"
  | "diplomacy.proposalName"
  | "diplomacy.proposalNamePlaceholder"
  | "diplomacy.reject"
  | "diplomacy.rejectFailed"
  | "diplomacy.rejected"
  | "diplomacy.responder"
  | "diplomacy.renew"
  | "diplomacy.renewAccepted"
  | "diplomacy.renewDeclined"
  | "diplomacy.renewDeclineFailed"
  | "diplomacy.renewFailed"
  | "diplomacy.renewSent"
  | "diplomacy.selectOtherPartyFirst"
  | "diplomacy.selectCountryForTreaty"
  | "diplomacy.selectClauseFromSides"
  | "diplomacy.selectTargetCountry"
  | "diplomacy.sendFailed"
  | "diplomacy.sendTooltip"
  | "diplomacy.submitAgreement"
  | "diplomacy.submitRevision"
  | "diplomacy.sent"
  | "diplomacy.signed"
  | "diplomacy.signFailed"
  | "diplomacy.storyActionFailed"
  | "diplomacy.storyArticle"
  | "diplomacy.storyArticles"
  | "diplomacy.storyArticlesCount"
  | "diplomacy.storyDefaultTitle"
  | "diplomacy.storyExpires"
  | "diplomacy.storyLoading"
  | "diplomacy.storyLoadingDescription"
  | "diplomacy.storyNegotiationChain"
  | "diplomacy.storyPendingAccept"
  | "diplomacy.storyPendingReject"
  | "diplomacy.storyRevision"
  | "diplomacy.storyRevisionHistory"
  | "diplomacy.storySubtitle"
  | "diplomacy.storyVersion"
  | "diplomacy.storyVersionRange"
  | "diplomacy.storyYourTurnFailed"
  | "diplomacy.status.accepted"
  | "diplomacy.status.expired"
  | "diplomacy.status.failed"
  | "diplomacy.status.pending"
  | "diplomacy.status.rejected"
  | "diplomacy.status.renewalPending"
  | "diplomacy.statusLine"
  | "diplomacy.title"
  | "diplomacy.subtitle"
  | "diplomacy.summaryConstructionRights"
  | "diplomacy.summaryMoney"
  | "diplomacy.summaryTransit"
  | "diplomacy.textNotePlaceholder"
  | "diplomacy.theirArticles"
  | "diplomacy.theirConditions"
  | "diplomacy.transportAir"
  | "diplomacy.transportLand"
  | "diplomacy.transportModes"
  | "diplomacy.transportPipeline"
  | "diplomacy.transportPowerGrid"
  | "diplomacy.transportSea"
  | "diplomacy.secondParty"
  | "diplomacy.resourceDucats"
  | "diplomacy.resourceGold"
  | "diplomacy.leftSide"
  | "diplomacy.rightSide"
  | "diplomacy.updateSent"
  | "diplomacy.waitingOtherSide"
  | "market.alerts"
  | "market.critical"
  | "market.criticalGoodsTooltip"
  | "market.countryDescription"
  | "market.countryTab"
  | "market.emptyRows"
  | "market.globalDescription"
  | "market.globalTab"
  | "market.good"
  | "market.goodCatalogTooltip"
  | "market.goodsInSelectionTooltip"
  | "market.history"
  | "market.historyTooltip"
  | "market.inviteAccepted"
  | "market.inviteRejected"
  | "market.inviteFailed"
  | "market.joined"
  | "market.joinFailed"
  | "market.joinRequestSent"
  | "market.leaveFailed"
  | "market.left"
  | "market.management"
  | "market.membership"
  | "market.metric.coverage"
  | "market.metric.demand"
  | "market.metric.offer"
  | "market.metric.price"
  | "market.metric.productionFact"
  | "market.metric.productionMax"
  | "market.noSelectedGood"
  | "market.other"
  | "market.recentTurns"
  | "market.sanctions"
  | "market.sortDeficit"
  | "market.sortPrice"
  | "market.sortVolatility"
  | "market.title"
  | "market.tradePartners"
  | "market.turnLabel"
  | "market.pointLabel"
  | "market.importCountriesTop"
  | "market.importMarketsTop"
  | "market.exportCountriesTop"
  | "market.exportMarketsTop"
  | "market.all"
  | "market.accept"
  | "market.actionColumn"
  | "market.addGood"
  | "market.addRuleEmpty"
  | "market.alertsDescription"
  | "market.alertsTitle"
  | "market.allGoods"
  | "market.apply"
  | "market.applyAll"
  | "market.applyPackage"
  | "market.bulkDirectionTooltip"
  | "market.bulkModeTooltip"
  | "market.cancelInvite"
  | "market.capColumn"
  | "market.confirmationTitle"
  | "market.countrySearch"
  | "market.delete"
  | "market.directionBoth"
  | "market.directionColumn"
  | "market.directionExport"
  | "market.directionImport"
  | "market.directionShortBoth"
  | "market.disable"
  | "market.durationPlaceholder"
  | "market.durationTooltip"
  | "market.enable"
  | "market.filterNoResults"
  | "market.fromLabel"
  | "market.goodColumn"
  | "market.incomingInvites"
  | "market.inviteCancelFailed"
  | "market.inviteCanceled"
  | "market.inviteSendFailed"
  | "market.inviteSent"
  | "market.inviteStatusExpires"
  | "market.joinMarket"
  | "market.joinRequestAlreadySent"
  | "market.leaveMarket"
  | "market.limitWithAmount"
  | "market.loading"
  | "market.logo"
  | "market.managementDescription"
  | "market.managementLoadFailed"
  | "market.managementOwnerOnly"
  | "market.managementTitle"
  | "market.marketNotFound"
  | "market.membershipDescription"
  | "market.membershipHint"
  | "market.membershipTitle"
  | "market.modeBan"
  | "market.modeCap"
  | "market.modeColumn"
  | "market.nameLabel"
  | "market.noAlerts"
  | "market.noInvites"
  | "market.noOutgoingInvites"
  | "market.noValidSanctionRules"
  | "market.notMember"
  | "market.outgoingInvites"
  | "market.ownerChanged"
  | "market.ownerLabel"
  | "market.ownerWarningBody"
  | "market.ownerWarningTitle"
  | "market.period"
  | "market.reject"
  | "market.ruleCapRequired"
  | "market.ruleGoodRequired"
  | "market.sanctionApplyFailed"
  | "market.sanctionBuilder"
  | "market.sanctionBuilderDescription"
  | "market.sanctionDeleted"
  | "market.sanctionDeleteFailed"
  | "market.sanctionList"
  | "market.sanctionsAdded"
  | "market.sanctionsDescription"
  | "market.sanctionsListDescription"
  | "market.sanctionsListTitle"
  | "market.sanctionsLoadFailed"
  | "market.sanctionsOwnerOnly"
  | "market.sanctionsTitle"
  | "market.sanctionUpdateFailed"
  | "market.save"
  | "market.selectCountry"
  | "market.selectedMarketSummary"
  | "market.selectMarket"
  | "market.selectNewOwner"
  | "market.selectTarget"
  | "market.sendInvite"
  | "market.sendInviteTooltip"
  | "market.sendRequest"
  | "market.settingsSection"
  | "market.statusActive"
  | "market.statusAll"
  | "market.statusExpired"
  | "market.statusPaused"
  | "market.stepConfirm"
  | "market.stepGoods"
  | "market.stepTarget"
  | "market.targetCountry"
  | "market.targetLabel"
  | "market.targetMarket"
  | "market.targetSelectTooltip"
  | "market.targetTypeCountry"
  | "market.targetTypeMarket"
  | "market.targetTypeTooltip"
  | "market.targetValue"
  | "market.transfer"
  | "market.transferFailed"
  | "market.transferOwnership"
  | "market.transferOwnerTooltip"
  | "market.turnsLeft"
  | "market.updateFailed"
  | "market.updateSuccess"
  | "market.visibilityLabel"
  | "market.visibilityMembers"
  | "market.visibilityPrivate"
  | "market.visibilityPublic"
  | "market.worldMarkets"
  | "population.countryTitle"
  | "population.worldTitle"
  | "population.countryRegionSubtitle"
  | "population.worldRegionSubtitle"
  | "population.groupsByRegion"
  | "population.regionColumn"
  | "population.regionsInScope"
  | "population.noNegativeRegionBalance"
  | "population.negativeRegionBalanceAlert"
  | "population.noLowRegionCapital"
  | "population.lowRegionCapitalAlert"
  | "population.aggregatedData"
  | "population.balance"
  | "population.brandingDescription"
  | "population.brandingTitle"
  | "population.births"
  | "population.birthsDeaths"
  | "population.birthsDeathsShort"
  | "population.budgetEnough"
  | "population.categoryBasic"
  | "population.categoryComfort"
  | "population.categoryLuxury"
  | "population.categorySurvival"
  | "population.categoryColumn"
  | "population.comfortShort"
  | "population.coverage"
  | "population.cultureColumn"
  | "population.deaths"
  | "population.dimensionCultures"
  | "population.dimensionIdeologies"
  | "population.dimensionProfessions"
  | "population.dimensionRaces"
  | "population.dimensionReligions"
  | "population.ducats"
  | "population.dominantReligion"
  | "population.expenseColumn"
  | "population.financeDescription"
  | "population.financeAlerts"
  | "population.financeTitle"
  | "population.flowGoodsExpense"
  | "population.flowOtherExpense"
  | "population.flowOtherIncome"
  | "population.flowTaxes"
  | "population.flowTransfers"
  | "population.flowWages"
  | "population.incomePerTurn"
  | "population.incomeStructure"
  | "population.largestCulture"
  | "population.lastTurnChange"
  | "population.legendCount"
  | "population.loyalists"
  | "population.marketDeficitGoods"
  | "population.marketGoodsAvailable"
  | "population.needBudgetShortage"
  | "population.netBalance"
  | "population.noData"
  | "population.openTabPrompt"
  | "population.panelTitle"
  | "population.peopleCount"
  | "population.popGroupsDescription"
  | "population.popGroupsTitle"
  | "population.professionColumn"
  | "population.professionNeedsDescription"
  | "population.professionNeedsTitle"
  | "population.professionsByPopGroups"
  | "population.professionsShort"
  | "population.raceColumn"
  | "population.radicals"
  | "population.radicalsLoyalists"
  | "population.radicalsLoyalistsShort"
  | "population.religionColumn"
  | "population.required"
  | "population.scope"
  | "population.scopeCountry"
  | "population.scopeWorld"
  | "population.sectionBranding"
  | "population.sectionCultures"
  | "population.sectionFinance"
  | "population.sectionGeneral"
  | "population.sectionGroups"
  | "population.sectionIdeologies"
  | "population.sectionNeeds"
  | "population.sectionProfessions"
  | "population.sectionRaces"
  | "population.sectionReligions"
  | "population.status"
  | "population.satisfactionShort"
  | "population.sizeColumn"
  | "population.survivalShort"
  | "population.totalCapital"
  | "population.totalExpenses"
  | "population.totalPopulation"
  | "population.visualReserved"
  | "population.expenseStructure"
  | "population.fulfilled"
  | "population.groupColumn"
  | "population.wallet"
  | "buildings.regionRequired"
  | "buildings.regionDependency"
  | "buildings.ownRegionOnlyDemolish"
  | "buildings.ownRegionOnlyUpgrade"
  | "buildings.ownRegionOnlyToggle"
  | "buildings.ownRegionOnlyRename"
  | "buildings.duplicateNameInRegion"
  | "buildings.modalDescription"
  | "buildings.sortRegion"
  | "buildings.filterRegionAll"
  | "buildings.regionLabel"
  | "buildings.extractedResourceTooltip"
  | "buildings.buildCountryTooltip"
  | "buildings.selectedRegionTooltip"
  | "buildings.selectedRegionLabel"
  | "buildings.selectRegion"
  | "buildings.confirmRegion"
  | "buildings.renamePrompt"
  | "buildings.filterActivityActive"
  | "buildings.filterActivityAll"
  | "buildings.filterActivityInactive"
  | "buildings.filterBuildingAll"
  | "buildings.filterCompanyAll"
  | "buildings.filterCompanyCountryAll"
  | "buildings.filterEconomyAll"
  | "buildings.filterEconomyLoss"
  | "buildings.filterEconomyProfit"
  | "buildings.filterIndustryAll"
  | "buildings.filterSectorAll"
  | "buildings.filterStatusAll"
  | "buildings.filterStatusBuilt"
  | "buildings.filterStatusConstruction"
  | "buildings.filters"
  | "buildings.industryTitle"
  | "buildings.openConstruction"
  | "buildings.regionCounts"
  | "buildings.resetFilters"
  | "buildings.sortBuilding"
  | "buildings.sortCompany"
  | "buildings.sortIndustry"
  | "buildings.sortSector"
  | "buildings.addToQueueTitle"
  | "buildings.addBuildingCta"
  | "buildings.addBuildingHint"
  | "buildings.available"
  | "buildings.availableBuildings"
  | "buildings.availableConstructionTooltip"
  | "buildings.availableDucatsTooltip"
  | "buildings.availableConstruction"
  | "buildings.buildingDescriptionMissing"
  | "buildings.buildingInactive"
  | "buildings.buildingCash"
  | "buildings.buildingCashTooltip"
  | "buildings.buildingLabel"
  | "buildings.buildingFallbackName"
  | "buildings.buildCountry"
  | "buildings.cancelPendingProjectTooltip"
  | "buildings.cancelQueuedProjectTooltip"
  | "buildings.cancelConstructionTitle"
  | "buildings.cancelConstructionTooltip"
  | "buildings.constructionCost"
  | "buildings.constructionParameters"
  | "buildings.constructionPointsUnit"
  | "buildings.constructionProgress"
  | "buildings.constructionQueue"
  | "buildings.constructionQueueEmpty"
  | "buildings.constructionQueueTooltip"
  | "buildings.constructionTitle"
  | "buildings.consumes"
  | "buildings.costLabel"
  | "buildings.countryLabel"
  | "buildings.countryDenied"
  | "buildings.countryLimitReached"
  | "buildings.countryNotAllowed"
  | "buildings.customNameLabel"
  | "buildings.customNameMissing"
  | "buildings.demolishBuildingTitle"
  | "buildings.demolishConstructionCost"
  | "buildings.demolishTooltip"
  | "buildings.disableAutoUpgradeTooltip"
  | "buildings.disableManualWorkTooltip"
  | "buildings.disableSubsidiesTooltip"
  | "buildings.durabilityLabel"
  | "buildings.durabilityTooltip"
  | "buildings.enableAutoUpgradeTooltip"
  | "buildings.enableManualWorkTooltip"
  | "buildings.enableSubsidiesTooltip"
  | "buildings.extraction"
  | "buildings.fertility"
  | "buildings.finance"
  | "buildings.financeGoodsPurchase"
  | "buildings.financeUpgrade"
  | "buildings.factualAmount"
  | "buildings.globalLimitReached"
  | "buildings.inputGoodsCost"
  | "buildings.inputGoodTooltip"
  | "buildings.inputCostTooltip"
  | "buildings.industryDescriptionMissing"
  | "buildings.industryLabel"
  | "buildings.inactiveLabel"
  | "buildings.inactiveLossNotCovered"
  | "buildings.instanceMissing"
  | "buildings.levelLabel"
  | "buildings.limitingFactor"
  | "buildings.limitingFactorLabel"
  | "buildings.limitingFactor.durability"
  | "buildings.limitingFactor.extraction"
  | "buildings.limitingFactor.finance"
  | "buildings.limitingFactor.infrastructure"
  | "buildings.limitingFactor.inputs"
  | "buildings.limitingFactor.labor"
  | "buildings.manualDisabledReason"
  | "buildings.maxAmount"
  | "buildings.maxDurability"
  | "buildings.maxLevel"
  | "buildings.netPerTurn"
  | "buildings.netPerTurnTooltip"
  | "buildings.noExtraction"
  | "buildings.noInputs"
  | "buildings.noOutputs"
  | "buildings.otherIndustry"
  | "buildings.owner"
  | "buildings.ownerCompanyMissing"
  | "buildings.ownerCompany"
  | "buildings.ownerCompanyDescriptionMissing"
  | "buildings.ownerCompanyLabel"
  | "buildings.ownerCompanyTooltip"
  | "buildings.ownerCountry"
  | "buildings.ownerCountryTooltip"
  | "buildings.ownerState"
  | "buildings.ownerType"
  | "buildings.ownerTypeTooltip"
  | "buildings.project"
  | "buildings.productivityLabel"
  | "buildings.productivityMetric"
  | "buildings.productivityTooltip"
  | "buildings.produces"
  | "buildings.production"
  | "buildings.outputGoodTooltip"
  | "buildings.outputIncomeTooltip"
  | "buildings.projectBuild"
  | "buildings.projectUpgrade"
  | "buildings.requirements"
  | "buildings.requirementsCannotAdd"
  | "buildings.requirementsCanAdd"
  | "buildings.requiresDeposit"
  | "buildings.requiredTechnology"
  | "buildings.regionFiltersEmpty"
  | "buildings.renameBuildingHint"
  | "buildings.renameBuildingLabel"
  | "buildings.renameBuildingPlaceholder"
  | "buildings.renameBuildingTitle"
  | "buildings.renameSave"
  | "buildings.renameTooltip"
  | "buildings.sectorDescriptionMissing"
  | "buildings.sectorLabel"
  | "buildings.salesRevenue"
  | "buildings.selectCompany"
  | "buildings.selectCountry"
  | "buildings.startingCapital"
  | "buildings.statuses"
  | "buildings.stateSubsidies"
  | "buildings.stateSubsidiesTooltip"
  | "buildings.stock"
  | "buildings.stockAvailable"
  | "buildings.stockEmpty"
  | "buildings.stockIncoming"
  | "buildings.stockOutgoing"
  | "buildings.stockRemainder"
  | "buildings.statusStopped"
  | "buildings.statusWorking"
  | "buildings.toastAutoUpgradeDisabled"
  | "buildings.toastAutoUpgradeEnabled"
  | "buildings.toastAutoUpgradeFailed"
  | "buildings.toastBuildCancelFailed"
  | "buildings.toastBuildCanceled"
  | "buildings.toastBuildNotFound"
  | "buildings.toastDemolishFailed"
  | "buildings.toastDemolished"
  | "buildings.toastDemolishInsufficientConstruction"
  | "buildings.toastDemolishNotFound"
  | "buildings.toastManualWorkDisabled"
  | "buildings.toastManualWorkEnabled"
  | "buildings.toastManualWorkFailed"
  | "buildings.toastRenameFailed"
  | "buildings.toastRenameReset"
  | "buildings.toastRenameUpdated"
  | "buildings.toastSubsidiesDisabled"
  | "buildings.toastSubsidiesEnabled"
  | "buildings.toastSubsidiesFailed"
  | "buildings.toastUpgradeAlreadyQueued"
  | "buildings.toastUpgradeFailed"
  | "buildings.toastUpgradeInsufficientDucats"
  | "buildings.toastUpgradeMaxReached"
  | "buildings.toastUpgradeQueued"
  | "buildings.tradeAmount"
  | "buildings.tradeBuyTooltip"
  | "buildings.tradeEmpty"
  | "buildings.tradeExpense"
  | "buildings.tradeExpenseTooltip"
  | "buildings.tradeIncome"
  | "buildings.tradeIncomeTooltip"
  | "buildings.tradeSellTooltip"
  | "buildings.tradeTurn"
  | "buildings.unavailable"
  | "buildings.upgradeAlreadyQueuedReason"
  | "buildings.upgradeBlockedTooltip"
  | "buildings.upgradeByStateTooltip"
  | "buildings.upgradeDucatsNeeded"
  | "buildings.upgradeMaxReached"
  | "buildings.wages"
  | "buildings.workforce"
  | "buildings.workersLabel"
  | "budget.category.baseIncome"
  | "budget.category.colonization"
  | "budget.category.construction"
  | "budget.category.customization"
  | "budget.category.provinceRename"
  | "budget.category.subsidies"
  | "budget.chart.expenses"
  | "budget.chart.expensesByCategory"
  | "budget.chart.income"
  | "budget.chart.incomeByCategory"
  | "budget.history.expenses"
  | "budget.history.income"
  | "budget.history.net"
  | "budget.history.projected"
  | "budget.history.treasury"
  | "budget.metric.currentTreasury"
  | "budget.metric.net"
  | "budget.metric.projectedEnd"
  | "budget.metric.turnExpenses"
  | "budget.metric.turnIncome"
  | "budget.subsidies.empty"
  | "budget.subsidies.paidThisTurn"
  | "budget.subsidies.region"
  | "budget.tab.expenses"
  | "budget.tab.history"
  | "budget.tab.subsidies"
  | "budget.tab.summary"
  | "budget.table.amount"
  | "budget.table.category"
  | "budget.table.expensesByCategory"
  | "budget.table.incomeByCategory"
  | "budget.title"
  | "budget.total.expenses"
  | "budget.total.income"
  | "provinceContext.openColonization"
  | "provinceContext.openProvinceKnowledge"
  | "provinceContext.createProvinceKnowledge"
  | "provinceContext.openAdminEditor"
  | "shell.action.army"
  | "shell.action.armyDescription"
  | "shell.action.budget"
  | "shell.action.budgetDescription"
  | "shell.action.buildings"
  | "shell.action.buildingsDescription"
  | "shell.action.customization"
  | "shell.action.customizationDescription"
  | "shell.action.decisions"
  | "shell.action.decisionsDescription"
  | "shell.action.diplomacy"
  | "shell.action.diplomacyDescription"
  | "shell.action.events"
  | "shell.action.eventsDescription"
  | "shell.action.globalMarket"
  | "shell.action.globalMarketDescription"
  | "shell.action.market"
  | "shell.action.marketDescription"
  | "shell.action.modifiers"
  | "shell.action.modifiersDescription"
  | "shell.action.politics"
  | "shell.action.politicsDescription"
  | "shell.action.population"
  | "shell.action.populationDescription"
  | "shell.action.technology"
  | "shell.action.technologyDescription"
  | "shell.action.turnStatus"
  | "shell.action.turnStatusDescription"
  | "shell.admin"
  | "shell.adminConsole"
  | "shell.adminPanel"
  | "shell.availableActions"
  | "shell.clientSettings"
  | "shell.codex"
  | "shell.connectedMessage"
  | "shell.connectedTitle"
  | "shell.countryCustomizedMessage"
  | "shell.countryCustomizedTitle"
  | "shell.contentPanel"
  | "shell.dashboard.activeProjects"
  | "shell.dashboard.activeResearch"
  | "shell.dashboard.army"
  | "shell.dashboard.armyIntro"
  | "shell.dashboard.availableConstruction"
  | "shell.dashboard.construction"
  | "shell.dashboard.constructionIntro"
  | "shell.dashboard.constructionSpend"
  | "shell.dashboard.controlledRegions"
  | "shell.dashboard.cultureReserve"
  | "shell.dashboard.diplomacy"
  | "shell.dashboard.diplomacyIntro"
  | "shell.dashboard.ducatFlow"
  | "shell.dashboard.goldReserve"
  | "shell.dashboard.governance"
  | "shell.dashboard.governanceIntro"
  | "shell.dashboard.market"
  | "shell.dashboard.marketIntro"
  | "shell.dashboard.notifications"
  | "shell.dashboard.overview"
  | "shell.dashboard.overviewIntro"
  | "shell.dashboard.pendingDecisions"
  | "shell.dashboard.population"
  | "shell.dashboard.populationIntro"
  | "shell.dashboard.religionReserve"
  | "shell.dashboard.scienceReserve"
  | "shell.dashboard.scienceSpend"
  | "shell.dashboard.totalPopulation"
  | "shell.dashboard.treasury"
  | "shell.endTurn"
  | "shell.entryCountryProfile"
  | "shell.entryEnterGame"
  | "shell.entryLoadedDescription"
  | "shell.entryLoadedTitle"
  | "shell.entryLoading"
  | "shell.entryLoadingDescription"
  | "shell.entryLoadingStatus"
  | "shell.entryReadyStatus"
  | "shell.entryProvinceIndex"
  | "shell.entryPublicUi"
  | "shell.entryWorldState"
  | "shell.forceResolve"
  | "shell.gameSettings"
  | "shell.globalMarketTitle"
  | "shell.localStateMissing"
  | "shell.loginMessage"
  | "shell.loginTitle"
  | "shell.logout"
  | "shell.logoutMessage"
  | "shell.logoutToast"
  | "shell.logoutTitle"
  | "shell.mapLens.army"
  | "shell.mapLens.construction"
  | "shell.mapLens.diplomacy"
  | "shell.mapLens.governance"
  | "shell.mapLens.market"
  | "shell.mapLens.overview"
  | "shell.mapLens.population"
  | "shell.mapLens.title"
  | "shell.metric.area"
  | "shell.metric.colonies"
  | "shell.metric.population"
  | "shell.metric.regions"
  | "shell.mode.army"
  | "shell.mode.armyDescription"
  | "shell.mode.construction"
  | "shell.mode.constructionDescription"
  | "shell.mode.diplomacy"
  | "shell.mode.diplomacyDescription"
  | "shell.mode.governance"
  | "shell.mode.governanceDescription"
  | "shell.mode.market"
  | "shell.mode.marketDescription"
  | "shell.mode.overview"
  | "shell.mode.overviewDescription"
  | "shell.mode.population"
  | "shell.mode.populationDescription"
  | "shell.modeDock"
  | "shell.notifications"
  | "shell.orderColonizationTitle"
  | "shell.orderArmyMoveMessage"
  | "shell.orderSent"
  | "shell.orderTitle"
  | "shell.preview.activeResearchDetail"
  | "shell.preview.armyLedger"
  | "shell.preview.averageOrganization"
  | "shell.preview.averageOrganizationDetail"
  | "shell.preview.bills"
  | "shell.preview.billsDetail"
  | "shell.preview.constructionQueue"
  | "shell.preview.diplomacyLedger"
  | "shell.preview.divisions"
  | "shell.preview.formationQueue"
  | "shell.preview.formationQueueDetail"
  | "shell.preview.governanceLedger"
  | "shell.preview.marketLedger"
  | "shell.preview.noArmy"
  | "shell.preview.noConstruction"
  | "shell.preview.noDiplomacy"
  | "shell.preview.noGovernance"
  | "shell.preview.noMarket"
  | "shell.preview.noPopulation"
  | "shell.preview.noStories"
  | "shell.preview.open"
  | "shell.preview.outboundProposals"
  | "shell.preview.outboundProposalsDetail"
  | "shell.preview.pendingResponse"
  | "shell.preview.pendingResponseDetail"
  | "shell.preview.populationLedger"
  | "shell.preview.populationTotal"
  | "shell.preview.records"
  | "shell.preview.recordsDetail"
  | "shell.preview.relatedTreaties"
  | "shell.preview.relatedTreatiesDetail"
  | "shell.preview.storyFeed"
  | "shell.preview.subsidies"
  | "shell.preview.topCulture"
  | "shell.preview.topProfession"
  | "shell.resource.colonization"
  | "shell.resource.construction"
  | "shell.resource.culture"
  | "shell.resource.ducats"
  | "shell.resource.gold"
  | "shell.resource.religion"
  | "shell.resource.science"
  | "sideNav.army"
  | "sideNav.budget"
  | "sideNav.buildings"
  | "sideNav.decisions"
  | "sideNav.diplomacy"
  | "sideNav.events"
  | "sideNav.globalMarket"
  | "sideNav.intel"
  | "sideNav.market"
  | "sideNav.modifiers"
  | "sideNav.politics"
  | "sideNav.population"
  | "sideNav.technology"
  | "sideNav.trade"
  | "topBar.adminForceResolve"
  | "topBar.clientSettings"
  | "topBar.colonizationLimit"
  | "topBar.contentPanel"
  | "topBar.controlledProvinces"
  | "topBar.countryDetails"
  | "topBar.currentTurn"
  | "topBar.currentValue"
  | "topBar.expensePerTurn"
  | "topBar.gameSettings"
  | "topBar.growthPerTurn"
  | "topBar.knowledgeBase"
  | "topBar.logout"
  | "topBar.netGrowth"
  | "topBar.netPerTurn"
  | "topBar.nextTurn"
  | "topBar.openCountryDetails"
  | "topBar.openResourceDetails"
  | "topBar.populationAria"
  | "topBar.populationDescription"
  | "topBar.resourceTip.colonization"
  | "topBar.resourceTip.construction"
  | "topBar.resourceTip.culture"
  | "topBar.resourceTip.ducats"
  | "topBar.resourceTip.gold"
  | "topBar.resourceTip.religion"
  | "topBar.resourceTip.science"
  | "topBar.time.day"
  | "topBar.time.hour"
  | "topBar.time.minute"
  | "topBar.time.second"
  | "topBar.totalArea"
  | "textInput.emptyResets"
  | "shell.readiness.empty"
  | "shell.readiness.offline"
  | "shell.readiness.online"
  | "shell.readiness.progress"
  | "shell.readiness.status.blocked"
  | "shell.readiness.status.ignored"
  | "shell.readiness.status.ready"
  | "shell.readiness.status.waiting"
  | "shell.readiness.title"
  | "shell.rejectedOrders"
  | "shell.rejectedOrdersMessage"
  | "shell.registrationAlreadyReviewed"
  | "shell.registrationApproved"
  | "shell.registrationReviewPrompt"
  | "shell.registrationReviewTitle"
  | "shell.registrationReviewUnavailable"
  | "shell.registrationRejected"
  | "shell.registrationReviewFailed"
  | "shell.replayRequested"
  | "shell.replayUnavailable"
  | "shell.resolveAutoUnconfirmed"
  | "shell.resolveDoneDescription"
  | "shell.resolveDoneTitle"
  | "shell.resolveDuration"
  | "shell.resolveForceDescription"
  | "shell.resolveManualUnconfirmed"
  | "shell.resolveProcessingDescription"
  | "shell.resolveProcessingTitle"
  | "shell.resolveReturn"
  | "shell.resolveTimeoutAutoDescription"
  | "shell.resolveTimeoutManualDescription"
  | "shell.resolveUnavailableDescription"
  | "shell.scenarioApplied"
  | "shell.scenarioAppliedDescription"
  | "shell.serverErrorTitle"
  | "shell.eventAlreadyResolved"
  | "shell.eventAutoResolved"
  | "shell.eventAutoResolvedDescription"
  | "shell.adminCommandSent"
  | "shell.adminCommandTitle"
  | "shell.adminOnly"
  | "shell.story.category.colonization"
  | "shell.story.category.diplomacy"
  | "shell.story.category.economy"
  | "shell.story.category.military"
  | "shell.story.category.politics"
  | "shell.story.category.system"
  | "shell.story.priority.high"
  | "shell.story.priority.low"
  | "shell.story.priority.medium"
  | "shell.turn"
  | "shell.turnCompletedTitle"
  | "shell.turnResolved"
  | "shell.turnResolvedClean"
  | "shell.turnStatus"
  | "shell.unnamedCountry"
  | "shell.worldResyncFailed"
  | "shell.worldResynced"
  | "shell.workspace"
  | "turnStatus.blockedPermanent"
  | "turnStatus.blockedUntilTime"
  | "turnStatus.blockedUntilTurn"
  | "turnStatus.lastLogin"
  | "turnStatus.loading"
  | "turnStatus.noLoginData"
  | "technology.cancelResearch"
  | "technology.description"
  | "technology.descriptionMissing"
  | "technology.empty"
  | "technology.loadFailed"
  | "technology.loading"
  | "technology.nodeCount"
  | "technology.notAvailable"
  | "technology.progress"
  | "technology.prerequisites"
  | "technology.researchAdded"
  | "technology.researchCanceled"
  | "technology.rootTechnology"
  | "technology.scienceCost"
  | "technology.selectPrompt"
  | "technology.startResearch"
  | "technology.status.available"
  | "technology.status.locked"
  | "technology.status.notSelected"
  | "technology.status.researched"
  | "technology.status.researching"
  | "technology.title"
  | "technology.unlockBuildings"
  | "technology.unlockLaws"
  | "technology.unlocks"
  | "technology.unlocksEmpty"
  | "technology.updateFailed";

const uiText: Record<UiLocale, Record<UiTextKey, string>> = {
  en: {
    "adminPanel.broadcastFailed": "Failed to send notification",
    "adminPanel.broadcastMissingFields": "Fill in notification title and text",
    "adminPanel.broadcastSent": "Notification sent to all players",
    "adminPanel.category.countries": "Country management",
    "adminPanel.category.notifications": "Notification broadcast",
    "adminPanel.category.population": "Population management",
    "adminPanel.category.provinces": "Provinces / Colonization",
    "adminPanel.countryDeleted": "Country deleted",
    "adminPanel.countryDeleteFailed": "Failed to delete country",
    "adminPanel.countryDeleteSelfFailed": "Cannot delete the country you are signed in as",
    "adminPanel.countryHasNoRegions": "The selected country has no regions",
    "adminPanel.countryUpdated": "Country updated",
    "adminPanel.countryUpdateFailed": "Failed to update country",
    "adminPanel.deleteCountryConfirm": "Delete country {country}?",
    "adminPanel.ignoreUpdated": "Turn-skip exclusion updated",
    "adminPanel.ignoreUpdateFailed": "Failed to update exclusion",
    "adminPanel.populationCleared": "Population cleared: {count} regions",
    "adminPanel.populationClearFailed": "Failed to clear population",
    "adminPanel.populationGenerated": "Population generated: {count} regions",
    "adminPanel.populationGenerateFailed": "Failed to generate population",
    "adminPanel.populationJsonInvalid": "Check pop-group JSON",
    "adminPanel.punishmentStatus.ignoredUntilTurn": "Ignored for turn skipping until #{turn}",
    "adminPanel.punishmentStatus.none": "No restrictions",
    "adminPanel.punishmentStatus.permanent": "Permanent login block",
    "adminPanel.punishmentStatus.untilTime": "Blocked until {time}",
    "adminPanel.punishmentStatus.untilTurn": "Blocked until turn #{turn}",
    "adminPanel.punishmentUpdated": "Punishment updated",
    "adminPanel.punishmentUpdateFailed": "Failed to apply punishment",
    "adminPanel.regionCostReset": "Region price reset to auto",
    "adminPanel.regionCostResetFailed": "Failed to reset price to auto",
    "adminPanel.regionPopulationUpdated": "Region population updated",
    "adminPanel.regionPopulationUpdateFailed": "Failed to update region population",
    "adminPanel.regionUpdated": "Region updated",
    "adminPanel.regionUpdateFailed": "Failed to update region",
    "adminPanel.selectCountry": "Select a country",
    "adminPanel.selectRegion": "Select a region",
    "common.cancel": "Cancel",
    "common.close": "Close",
    "common.confirm": "Confirm",
    "common.pending": "Applying...",
    "common.refresh": "Refresh",
    "common.save": "Save",
    "common.saving": "Saving...",
    "commandPalette.action.budget": "Open budget",
    "commandPalette.action.province": "Go to province selection",
    "commandPalette.action.resolve": "Request resolve",
    "commandPalette.action.routes": "Open trade routes",
    "commandPalette.action.politics": "Open politics",
    "commandPalette.actions": "Actions",
    "commandPalette.empty": "No results found",
    "commandPalette.placeholder": "Commands and navigation...",
    "customSelect.noOptions": "No options",
    "customSelect.placeholder": "Select a value",
    "countryEvents.choiceRequired": "Event requires a choice",
    "countryEvents.defaultEvent": "Event",
    "countryEvents.effectFallback": "Effect",
    "countryEvents.empty": "No events",
    "countryEvents.emptyDescription": "The country has no pending events right now.",
    "countryEvents.historyEmpty": "History is empty",
    "countryEvents.historyEmptyDescription": "The country has not chosen event options yet.",
    "countryEvents.historyMeta": "{option} · turn {turn}",
    "countryEvents.important": "Important",
    "countryEvents.importantPending": "{count} important events await a choice",
    "countryEvents.loadFailed": "Failed to load events",
    "countryEvents.loading": "Loading events",
    "countryEvents.loadingDescription": "Checking pending events.",
    "countryEvents.notificationLoadingDescription": "Opening the event from notification.",
    "countryEvents.optionFailed": "Failed to choose option",
    "countryEvents.processed": "Event processed",
    "countryEvents.storySubtitle": "Country event · turn {turn}",
    "countryEvents.title": "Country events",
    "customization.afterPurchase": "After purchase",
    "customization.applied": "Changes applied (-{ducats} ducats)",
    "customization.applyFailed": "Failed to apply country changes",
    "customization.availableDucats": "Available: {ducats} ducats",
    "customization.buyAndApply": "Buy and apply",
    "customization.changeColor": "Change color",
    "customization.changeCrest": "Change crest",
    "customization.changeFlag": "Change flag",
    "customization.costTitle": "Change cost",
    "customization.crestPreviewAlt": "Crest preview",
    "customization.currentCrestAlt": "Current crest",
    "customization.currentFlagAlt": "Current flag",
    "customization.flagPreviewAlt": "Flag preview",
    "customization.insufficientDucats": "Not enough ducats: need {need}, available {available}",
    "customization.loadingPrices": "Loading prices...",
    "customization.loadPricesFailed": "Failed to load customization prices",
    "customization.noChanges": "No changes to save",
    "customization.notEnoughDucats": "Not enough ducats",
    "customization.notSelected": "Not selected",
    "customization.rename": "Rename",
    "customization.saving": "Saving...",
    "customization.total": "Total",
    "eventLog.category": "Category: {category}",
    "eventLog.categories": "Categories",
    "eventLog.clear": "Clear log",
    "eventLog.collapse": "Collapse event log",
    "eventLog.countTooltip": "Number of log entries",
    "eventLog.countryFilter": "Country filter",
    "eventLog.countryScope": "Ownership",
    "eventLog.countryTooltip": "Country: {country}",
    "eventLog.duplicateCount": "How many identical events are grouped",
    "eventLog.empty": "No events",
    "eventLog.expand": "Expand event log",
    "eventLog.expandMessage": "Show full message",
    "eventLog.groupDuplicatesOff": "Grouping: off",
    "eventLog.groupDuplicatesOn": "Grouping: on",
    "eventLog.groupDuplicatesTooltip": "Group identical events into one entry with an xN counter",
    "eventLog.hideMessage": "Hide full message",
    "eventLog.priority": "Priority",
    "eventLog.priorityHigh": "High priority",
    "eventLog.priorityLow": "Low priority",
    "eventLog.priorityMedium": "Medium priority",
    "eventLog.priorityTooltip": "Show events with priority: {priority}",
    "eventLog.privateTooltip": "Private event (visible only to your country)",
    "eventLog.scope.all": "All",
    "eventLog.scope.foreign": "Foreign",
    "eventLog.scope.own": "Ours",
    "eventLog.scopeTooltip": "Show: {scope} events",
    "eventLog.sortPriority": "Sorting: by priority",
    "eventLog.sortTime": "Sorting: by time",
    "eventLog.systemAlwaysVisible": "System events are always visible",
    "eventLog.title": "Event log",
    "eventLog.trimOld": "Hide old entries",
    "eventLog.turn": "Turn #{turn}",
    "eventLog.turnTooltip": "Event recorded on turn #{turn}",
    "gameSettings.applyScenarioConfirm": "Start a new game with scenario \"{scenario}\"?\n\nThe current world state, queues, and progress will be reset.",
    "gameSettings.autoCostsRecalculated": "Auto prices recalculated: {count}",
    "gameSettings.autoCostsRecalculateFailed": "Failed to recalculate auto prices",
    "gameSettings.backgroundCleared": "Interface background removed",
    "gameSettings.backgroundClearFailed": "Failed to remove interface background",
    "gameSettings.backgroundCurrent": "Current background",
    "gameSettings.backgroundDelete": "Remove background",
    "gameSettings.backgroundEmpty": "No background set",
    "gameSettings.backgroundSaved": "Interface background updated",
    "gameSettings.backgroundSaveFailed": "Failed to update interface background",
    "gameSettings.backgroundSelectFirst": "Choose an image first",
    "gameSettings.backgroundTitle": "Interface background image (max 4096x4096)",
    "gameSettings.backgroundTooLarge": "Background image must be at most 4096x4096",
    "gameSettings.backgroundUpload": "Upload background",
    "gameSettings.category.background": "Interface background",
    "gameSettings.category.colonization": "Colonization",
    "gameSettings.category.customization": "Customization",
    "gameSettings.category.economy": "Economy",
    "gameSettings.category.eventLog": "Event log",
    "gameSettings.category.registration": "Registration",
    "gameSettings.category.resourceIcons": "Point icons",
    "gameSettings.category.scenarios": "Scenarios",
    "gameSettings.category.turnTimer": "Turn timer",
    "gameSettings.chooseFile": "Choose file",
    "gameSettings.chooseImage": "Choose image",
    "gameSettings.colonization.costNote": "Base region cost is calculated from area: rate per 1000 km2 x area / 1000. Manual region cost in the admin editor remains an override.",
    "gameSettings.colonization.ducatsCost": "Cost (ducats) per 1000 km2",
    "gameSettings.colonization.maxActive": "Max simultaneous colonizations",
    "gameSettings.colonization.pointsCost": "Cost (colonization points) per 1000 km2",
    "gameSettings.colonization.pointsPerTurn": "Colonization points / turn",
    "gameSettings.colonization.settlersDescription": "Adds population only on first capture of an empty region",
    "gameSettings.colonization.settlersDisable": "Disable starting settlers",
    "gameSettings.colonization.settlersEnable": "Enable starting settlers",
    "gameSettings.colonization.settlersEnabled": "Starting settlers",
    "gameSettings.colonization.settlersOnCapture": "Settlers on empty-region capture",
    "gameSettings.colonizationSaved": "Colonization settings saved",
    "gameSettings.colonizationSaveFailed": "Failed to save colonization settings",
    "gameSettings.colonizationTitle": "Colonization limits",
    "gameSettings.customization.crest": "Change crest",
    "gameSettings.customization.flag": "Change flag",
    "gameSettings.customization.recolor": "Change color",
    "gameSettings.customization.renameCountry": "Rename country",
    "gameSettings.customization.renameProvince": "Rename province",
    "gameSettings.customizationSaved": "Customization prices saved",
    "gameSettings.customizationSaveFailed": "Failed to save customization prices",
    "gameSettings.customizationTitle": "Country change prices in ducats",
    "gameSettings.economy.constructionPerTurn": "Construction points / turn",
    "gameSettings.economy.culturePerTurn": "Culture / turn",
    "gameSettings.economy.demolitionCost": "Demolition cost (% construction)",
    "gameSettings.economy.ducatsPerTurn": "Ducats / turn",
    "gameSettings.economy.durabilityDecay": "Durability loss / turn (inactive)",
    "gameSettings.economy.durabilityRecovery": "Durability recovery / turn (active)",
    "gameSettings.economy.explorationDepletion": "Empty chance increase per attempt (%)",
    "gameSettings.economy.explorationDuration": "Exploration duration (turns)",
    "gameSettings.economy.explorationEmptyChance": "Base empty exploration chance (%)",
    "gameSettings.economy.explorationRolls": "Rolls per exploration",
    "gameSettings.economy.goldPerTurn": "Gold / turn",
    "gameSettings.economy.marketSmoothing": "Market price smoothing (0..1)",
    "gameSettings.economy.pollutionEffect": "Pollution effect / 1000",
    "gameSettings.economy.religionPerTurn": "Religion / turn",
    "gameSettings.economy.sciencePerTurn": "Science / turn",
    "gameSettings.economySaved": "Economy settings saved",
    "gameSettings.economySaveFailed": "Failed to save economy settings",
    "gameSettings.economyTitle": "Base income for every turn resolve",
    "gameSettings.eventLogRetention": "Keep events from the last turns",
    "gameSettings.eventLogSaved": "Event log settings saved",
    "gameSettings.eventLogSaveFailed": "Failed to save event log settings",
    "gameSettings.eventLogTitle": "Global event log settings",
    "gameSettings.fileSelected": "Selected file: {file}",
    "gameSettings.loadFailed": "Failed to load game settings",
    "gameSettings.loading": "Loading settings...",
    "gameSettings.map.hideAntarctica": "Hide Antarctica",
    "gameSettings.map.showAntarctica": "Show Antarctica",
    "gameSettings.map.showAntarcticaAction": "Show Antarctica",
    "gameSettings.map.showAntarcticaDescription": "Hides Antarctica provinces on the map for all players",
    "gameSettings.no": "no",
    "gameSettings.recalculateAutoCosts": "Recalculate all auto prices",
    "gameSettings.registrationApprovalDisable": "Disable registration approval",
    "gameSettings.registrationApprovalEnable": "Enable registration approval",
    "gameSettings.registrationRequireApproval": "Require administrator approval",
    "gameSettings.registrationRequireApprovalDescription": "New countries register, but cannot enter until an admin approves them",
    "gameSettings.registrationSaved": "Registration settings saved",
    "gameSettings.registrationSaveFailed": "Failed to save registration settings",
    "gameSettings.registrationTitle": "New country registration",
    "gameSettings.resource.population": "Population",
    "gameSettings.resourceIconEmpty": "No icon",
    "gameSettings.resourceIconSelectFirst": "Choose at least one icon first",
    "gameSettings.resourceIconsSaved": "Point icons updated",
    "gameSettings.resourceIconsSaveFailed": "Failed to update point icons",
    "gameSettings.resourceIconsTitle": "Top bar point icons (max 64x64)",
    "gameSettings.resourceIconsUpload": "Upload icons",
    "gameSettings.resourceIconTooLarge": "Icon must be at most 64x64",
    "gameSettings.resourceIconTooLargeFor": "{resource} icon must be at most 64x64",
    "gameSettings.scenarioActive": "Active",
    "gameSettings.scenarioApplied": "Scenario applied",
    "gameSettings.scenarioAppliedDescription": "Reloading map and world state",
    "gameSettings.scenarioApplyFailed": "Failed to apply scenario",
    "gameSettings.scenarioFiles": "Content: {content} files · Setup: {setup} files",
    "gameSettings.scenarioMap": "Map: {map}",
    "gameSettings.scenarioMvt": "MVT {value}",
    "gameSettings.scenarioRaster": "Raster {value}",
    "gameSettings.scenariosDescription": "A scenario switches the map, content library, and starting setup files. Applying a scenario creates a new game and resets the current world state.",
    "gameSettings.scenarioSelected": "Selected",
    "gameSettings.scenariosEmpty": "No scenarios found. Add folders in apps/server/data/scenarios.",
    "gameSettings.scenariosLoadFailed": "Failed to load scenarios",
    "gameSettings.scenariosLoading": "Loading scenarios...",
    "gameSettings.scenarioStart": "Start",
    "gameSettings.scenarioStarting": "Starting...",
    "gameSettings.scenarioStartTurn": "Start turn: {turn}",
    "gameSettings.scenariosTitle": "New game scenarios",
    "gameSettings.title": "Game settings",
    "gameSettings.turnTimerDisable": "Disable turn timer",
    "gameSettings.turnTimerEnable": "Enable turn timer",
    "gameSettings.turnTimerEnabled": "Enable automatic turn advance",
    "gameSettings.turnTimerEnabledDescription": "The server resolves the turn by timer even if not every country pressed next turn",
    "gameSettings.turnTimerPauseDisable": "Disable timer pause without players",
    "gameSettings.turnTimerPauseEnable": "Enable timer pause without players",
    "gameSettings.turnTimerPauseOffline": "Pause timer without online players",
    "gameSettings.turnTimerPauseOfflineDescription": "When enabled, the auto timer does not tick while 0 players are online.",
    "gameSettings.turnTimerRange": "Range: 10-2,592,000 seconds (up to 30 days). The timer resets after each turn resolve.",
    "gameSettings.turnTimerSaved": "Turn timer saved",
    "gameSettings.turnTimerSaveFailed": "Failed to save turn timer",
    "gameSettings.turnTimerSeconds": "Seconds per turn",
    "gameSettings.turnTimerTitle": "Automatic turn advance by timer",
    "gameSettings.yes": "yes",
    "auth.accountLockedPermanent": "Account is locked permanently",
    "auth.accountLockedTime": "Account is locked until {time}",
    "auth.accountLockedTurn": "Account is locked until turn #{turn}",
    "auth.chooseCountry": "Choose a country",
    "auth.clientVersion": "client v0.1.0",
    "auth.country": "Country",
    "auth.countryColor": "Country color",
    "auth.countryCreated": "Country created; now sign in",
    "auth.countryName": "Country name",
    "auth.createCountry": "Create country",
    "auth.creating": "Creating...",
    "auth.crest": "Crest",
    "auth.crestHint": "PNG/JPG/WEBP up to 4MB, maximum 128x192, ratio 2:3",
    "auth.crestInvalid": "Crest: maximum 128x192, ratio 2:3",
    "auth.crestPreview": "Crest preview",
    "auth.enterGame": "Sign in",
    "auth.enterPassword": "Enter password",
    "auth.fileTooLarge": "File is too large (up to 4MB)",
    "auth.flag": "Flag",
    "auth.flagHint": "PNG/JPG/WEBP up to 4MB, maximum 192x128, ratio 3:2",
    "auth.flagInvalid": "Flag: maximum 192x128, ratio 3:2",
    "auth.flagPreview": "Flag preview",
    "auth.imageFormatInvalid": "Check format: flag 192x128 (3:2), crest 128x192 (2:3)",
    "auth.invalidHex": "Enter a valid HEX color",
    "auth.invalidPassword": "Invalid password",
    "auth.knowledge": "Knowledge archive",
    "auth.loadingGame": "Loading game...",
    "auth.lockReason": "Reason: {reason}",
    "auth.login": "Login",
    "auth.loginPending": "Signing in...",
    "auth.loginSuccess": "Signed in",
    "auth.min2": "Minimum 2 characters",
    "auth.min8": "Minimum 8 characters",
    "auth.noFileSelected": "Not selected",
    "auth.onlyImages": "Only images are allowed",
    "auth.password": "Password",
    "auth.passwordComplexityAria": "Password complexity check",
    "auth.passwordComplexityLoginNeed": "Add letters and digits for complexity",
    "auth.passwordComplexityNeed": "Add an uppercase letter, digit, and special character",
    "auth.passwordComplexityOk": "Password complexity is good",
    "auth.passwordLengthAria": "Password length check",
    "auth.passwordLengthNeed": "Needs at least 8 characters",
    "auth.passwordLengthOk": "Password length is good",
    "auth.passwordMismatch": "Passwords do not match",
    "auth.presetColor": "Choose {color}",
    "auth.register": "Register",
    "auth.registrationError": "Registration failed",
    "auth.registrationPendingApproval": "Registration is awaiting administrator approval",
    "auth.registrationPendingDescription": "You can enter the game after the request is approved.",
    "auth.registrationSent": "Registration request sent",
    "auth.registrationSentMessage": "Country {country} has been sent to administrators for approval.",
    "auth.rememberMe": "Remember me",
    "auth.repeatPassword": "Repeat password",
    "auth.selectCountry": "Select country",
    "auth.selectImage": "Choose image",
    "auth.serverStatus.maintenance": "Maintenance",
    "auth.serverStatus.offline": "Offline",
    "auth.serverStatus.online": "Online",
    "auth.serverUnavailable": "Server unavailable",
    "auth.waitButton": "I will wait",
    "clientSettings.description": "These settings do not affect the server game and apply only in your browser.",
    "clientSettings.descriptionTitle": "Description",
    "clientSettings.interface": "Interface",
    "clientSettings.language": "Language",
    "clientSettings.languageDescription": "Controls guarded client UI text. older screens are being migrated gradually.",
    "clientSettings.localNote": "Settings are saved locally for each country.",
    "clientSettings.mapControls": "Map controls panel",
    "clientSettings.mapControlsDescription": "Zoom, reset, and map lock buttons in the lower right corner.",
    "clientSettings.save": "Save",
    "clientSettings.sortNotifications": "Notification sorting",
    "clientSettings.sortNotificationsDescription": "When opened, unread notifications are moved left / to the end of the row.",
    "clientSettings.title": "Client settings",
    "clientSettings.uiLanguage": "UI language",
    "civilopedia.admin.addCategory": "Add",
    "civilopedia.admin.articleEditor": "Article editor (Knowledge archive)",
    "civilopedia.admin.articleImage": "Article image",
    "civilopedia.admin.articleImageHint": "Article cover: maximum 1024x1024",
    "civilopedia.admin.category": "Category",
    "civilopedia.admin.categoryExistsDescription": "Move or delete articles from this category first",
    "civilopedia.admin.categoryExistsTitle": "Cannot delete category",
    "civilopedia.admin.categoryInputPlaceholder": "New category",
    "civilopedia.admin.categoryManualPlaceholder": "Or enter manually",
    "civilopedia.admin.categoryTitle": "Article categories",
    "civilopedia.admin.copiedToken": "Token copied",
    "civilopedia.admin.defaultArticleTitle": "New article",
    "civilopedia.admin.defaultSectionTitle": "Content",
    "civilopedia.admin.deleteCategory": "Delete category",
    "civilopedia.admin.description": "Short description",
    "civilopedia.admin.emptyEditor": "Select an article to edit",
    "civilopedia.admin.inlineHint": "Use in text: [img:URL|64]",
    "civilopedia.admin.inlineImage": "Inline 64x64 images in text",
    "civilopedia.admin.inlineImageDescription": "Token is shown below. Insert it into a paragraph.",
    "civilopedia.admin.inlineImageLimit": "Upload limit: maximum 64x64",
    "civilopedia.admin.inlineUpload": "Upload 64x64",
    "civilopedia.admin.keywords": "Tags (comma-separated)",
    "civilopedia.admin.noImage": "No image",
    "civilopedia.admin.provinceArticleMissing": "Province article not found",
    "civilopedia.admin.provinceCategory": "Provinces",
    "civilopedia.admin.provinceDefaultBody": "Fill in the description, strategic value, colonization specifics, and historical notes.",
    "civilopedia.admin.provinceDefaultSummary": "Reference article for province {province}.",
    "civilopedia.admin.provinceDefaultTitle": "Province: {province}",
    "civilopedia.admin.provinceIdLine": "Province ID: {provinceId}",
    "civilopedia.admin.relatedCsv": "Related articles (comma-separated IDs)",
    "civilopedia.admin.removeCategoryBlocked": "Cannot delete category",
    "civilopedia.admin.removeCategoryBlockedDescription": "Move or delete articles from this category first",
    "civilopedia.admin.saveArticle": "Save article",
    "civilopedia.admin.saved": "Knowledge archive saved",
    "civilopedia.admin.saveFailed": "Failed to save Knowledge archive",
    "civilopedia.admin.sectionFormatHint": "Section format: an array of objects like { title, paragraphs: [..] }.",
    "civilopedia.admin.sectionsJson": "Sections (JSON)",
    "civilopedia.admin.title": "Title",
    "civilopedia.admin.untitled": "Untitled",
    "civilopedia.admin.upload": "Upload",
    "civilopedia.admin.uploadedImage": "Image uploaded",
    "civilopedia.admin.uploadImageFailed": "Failed to upload image",
    "civilopedia.admin.uploadedInlineImage": "Inline image uploaded",
    "civilopedia.admin.uploadInlineImageFailed": "Failed to upload inline image",
    "civilopedia.admin.uploadInlineImageHint": "Colored words: [color:#22c55e]text[/color]",
    "civilopedia.admin.urlPlaceholder": "Image URL",
    "civilopedia.category.basics": "Basics",
    "civilopedia.category.colonization": "Colonization",
    "civilopedia.category.economy": "Resources and economy",
    "civilopedia.category.journal": "Event log",
    "civilopedia.category.map": "Map",
    "civilopedia.category.other": "Other",
    "civilopedia.category.turns": "Turns and timer",
    "civilopedia.description": "Reference for game mechanics and interface",
    "civilopedia.edit": "Edit",
    "civilopedia.editMode": "Editing mode",
    "civilopedia.emptySelection": "Select an article on the left",
    "civilopedia.loading": "Loading...",
    "civilopedia.loadFailed": "Failed to load Knowledge archive",
    "civilopedia.newArticle": "New article",
    "civilopedia.noResults": "Nothing found",
    "civilopedia.related": "Related articles",
    "civilopedia.searchPlaceholder": "Search articles...",
    "civilopedia.title": "Knowledge archive",
    "decisions.available": "Available",
    "decisions.category.colonization": "Colonization",
    "decisions.category.culture": "Culture",
    "decisions.category.diplomacy": "Diplomacy",
    "decisions.category.economy": "Economy",
    "decisions.category.military": "Army",
    "decisions.category.politics": "Politics",
    "decisions.category.religion": "Religion",
    "decisions.category.technology": "Technology",
    "decisions.cost": "Cost",
    "decisions.effectFallback": "Effect",
    "decisions.effects": "Effects",
    "decisions.emptyAvailable": "There are no available decisions right now.",
    "decisions.emptyLocked": "There are no locked decisions.",
    "decisions.emptyTitle": "No decisions",
    "decisions.history": "History",
    "decisions.historyEmpty": "History is empty",
    "decisions.historyEmptyDescription": "The country has not taken decisions yet.",
    "decisions.loadFailed": "Failed to load decisions",
    "decisions.loading": "Loading decisions",
    "decisions.loadingDescription": "Checking country conditions.",
    "decisions.locked": "Locked",
    "decisions.notAvailable": "Decision unavailable",
    "decisions.none": "None",
    "decisions.open": "Open",
    "decisions.resource.colonization": "Colonization",
    "decisions.resource.construction": "Construction",
    "decisions.resource.culture": "Culture",
    "decisions.resource.ducats": "Ducats",
    "decisions.resource.gold": "Gold",
    "decisions.resource.religion": "Religion",
    "decisions.resource.science": "Science",
    "decisions.storySubtitle": "Country decision · {category}",
    "decisions.take": "Take decision",
    "decisions.taken": "Decision taken",
    "decisions.takeFailed": "Failed to take decision",
    "decisions.title": "Country decisions",
    "decisions.turn": "Turn {turn}",
    "elections.distribution": "Seat distribution",
    "elections.distributionDescription": "Parliament semicircle by party",
    "elections.empty": "No election result data",
    "elections.government": "Government",
    "elections.noPartySeats": "No party received seats",
    "elections.parties": "Parties",
    "elections.parliamentDescription": "Parliamentary vote results",
    "elections.seatShare": "Seats: {value}",
    "elections.seats": "seats",
    "elections.subtitle": "Turn #{turn} · parliament with {seats} seats",
    "elections.title": "Election results",
    "elections.tooltipVotes": "Votes: {value}",
    "elections.voteShare": "Votes: {value}",
    "army.air": "Air wings",
    "army.attack": "Attack",
    "army.baseProvince": "Base province",
    "army.battleSlots": "Combat slots",
    "army.branchTemplates": "Templates: {branch}",
    "army.cancel": "Cancel",
    "army.composition": "Composition",
    "army.createFormation": "Form unit",
    "army.defaultAir": "New air wing",
    "army.defaultLand": "New division",
    "army.defaultNaval": "New fleet",
    "army.delete": "Delete",
    "army.defense": "Defense",
    "army.description": "Templates, formation, and basing for divisions, fleets, and air wings",
    "army.disbandDivision": "Disband division",
    "army.emptyQueue": "Queue is empty",
    "army.emptyQueueDescription": "New units appear here after a formation command.",
    "army.form": "Form",
    "army.formation": "Formation",
    "army.formationQueue": "Formation queue",
    "army.formationSpeed": "Formation speed: {speed}",
    "army.icon64": "Logo 64x64",
    "army.iconInvalid64": "Logo must be exactly 64x64.",
    "army.iconUploadFailed": "Failed to upload logo.",
    "army.land": "Divisions",
    "army.location": "Location",
    "army.loading": "Loading armed forces",
    "army.loadingDescription": "Fetching templates, units, and queue.",
    "army.march": "March",
    "army.manpowerShort": "{count} men",
    "army.moveActive": "Movement mode active",
    "army.moveCancel": "Cancel movement",
    "army.movePickDestination": "Click a province on the map to choose the destination",
    "army.naval": "Fleets",
    "army.newTemplate": "New",
    "army.noData": "No data",
    "army.noDataDescription": "Open this window after connecting to the server.",
    "army.noReadyUnits": "No ready units",
    "army.noReadyUnitsDescription": "Put a unit formation in the queue.",
    "army.organizationShort": "Org.",
    "army.queue": "Queue ({count})",
    "army.readyUnits": "Ready units: {branch}",
    "army.saveTemplate": "Save template",
    "army.strengthShort": "Strength",
    "army.support": "Support",
    "army.supplyShort": "Supply",
    "army.totalBattalions": "{count} battalions",
    "army.totalSoldiers": "{count} soldiers",
    "army.templateDeleted": "Template deleted",
    "army.templateName": "Template name",
    "army.unknownBattalion": "Battalion {number}",
    "army.unknownTemplate": "Unknown template",
    "army.title": "Armed forces",
    "army.unitName": "Unit name",
    "locale.english": "English",
    "locale.russian": "Russian",
    "map.controls.zoomIn": "Zoom in",
    "map.controls.zoomOut": "Zoom out",
    "map.controls.resetView": "Reset center and zoom",
    "map.controls.lockInteraction": "Lock pan/zoom",
    "map.controls.unlockInteraction": "Unlock pan/zoom",
    "map.mode.regions.label": "Regions",
    "map.mode.regions.shortLabel": "Regions",
    "map.mode.regions.legendLabel": "State region",
    "map.mode.regions.legendDescription": "Provinces grouped by their gameplay region",
    "map.mode.provinceColors.label": "Province colors",
    "map.mode.provinceColors.shortLabel": "Provinces",
    "map.mode.provinceColors.legendLabel": "Province",
    "map.mode.provinceColors.legendDescription": "Authored scenario colors for lightweight map provinces",
    "modifiers.activeCount": "Active effects: {count}",
    "modifiers.column.effect": "Effect",
    "modifiers.column.modifier": "Modifier",
    "modifiers.column.mode": "Type",
    "modifiers.column.scope": "Scope",
    "modifiers.column.source": "Source",
    "modifiers.column.target": "Target",
    "modifiers.column.value": "Value",
    "modifiers.description": "{country} · {count} effects",
    "modifiers.empty": "This country has no active modifiers yet",
    "modifiers.loadFailed": "Failed to load modifiers",
    "modifiers.loading": "Loading modifiers...",
    "modifiers.scope.building": "Building",
    "modifiers.scope.country": "Country",
    "modifiers.scope.market": "Market",
    "modifiers.scope.pop": "Population",
    "modifiers.scope.province": "Province",
    "modifiers.source.event": "Event",
    "modifiers.source.law": "Law",
    "modifiers.source.modifier": "Modifier",
    "modifiers.source.technology": "Technology",
    "modifiers.stat.building_construction_cost": "Construction cost",
    "modifiers.stat.building_input": "Building input",
    "modifiers.stat.building_output": "Building output",
    "modifiers.stat.building_throughput": "Building throughput",
    "modifiers.stat.building_wage": "Building wages",
    "modifiers.stat.colonization_gain": "Colonization gain",
    "modifiers.stat.construction_gain": "Construction gain",
    "modifiers.stat.culture_gain": "Culture gain",
    "modifiers.stat.ducats_gain": "Ducat gain",
    "modifiers.stat.gold_gain": "Gold gain",
    "modifiers.stat.religion_gain": "Religion gain",
    "modifiers.stat.science_gain": "Science gain",
    "modifiers.stat.technology_cost": "Technology cost",
    "modifiers.target.all": "All eligible targets",
    "modifiers.target.building": "building: {value}",
    "modifiers.target.category": "category: {value}",
    "modifiers.target.good": "good: {value}",
    "modifiers.target.profession": "profession: {value}",
    "modifiers.title": "Country modifiers",
    "notifications.category.diplomacy": "Diplomacy",
    "notifications.category.economy": "Economy",
    "notifications.category.politics": "Politics",
    "notifications.category.registration": "Registration",
    "notifications.category.system": "System",
    "notifications.delete": "Remove notification from history",
    "notifications.electionResults": "Election results: parliament formed with {seats} seats",
    "notifications.emptyHistory": "Notification history is empty.",
    "notifications.fallback.countryEvent": "New event",
    "notifications.fallback.diplomacy": "Diplomatic treaty",
    "notifications.fallback.electionResults": "Election results",
    "notifications.fallback.generic": "Notification",
    "notifications.fallback.registration": "Registration request",
    "politics.aboutSelectedLaw": "About selected law",
    "politics.activePowerLaws": "Active source laws",
    "politics.billStarted": "Bill submitted to parliament",
    "politics.billStartFailed": "Failed to submit bill",
    "politics.billStatusDebating": "Debating",
    "politics.chartTooltip": "{name}: {seats} seats",
    "politics.currentBills": "Bills under vote",
    "politics.currentLimits": "Current limits",
    "politics.defaultPower": "Using the baseline power",
    "politics.description": "Election review in {turns} turns.",
    "politics.discipline": "Disc. {value}%",
    "politics.interestGroups": "Interest groups",
    "politics.lawAction.enact": "Enact",
    "politics.lawAction.vote": "To vote",
    "politics.lawAlreadyActive": "This law is already active",
    "politics.lawAlreadyInVote": "Already under vote",
    "politics.laws": "Laws",
    "politics.lawStatus.active": "Active",
    "politics.lawStatus.inactive": "Not enacted",
    "politics.lawStatus.voting": "Voting",
    "politics.legend.abstain": "Gray: mostly abstaining",
    "politics.legend.oppose": "Red: party majority opposes",
    "politics.legend.partyColors": "Normal mode: party colors",
    "politics.legend.support": "Green: party majority supports",
    "politics.limit.laws": "Laws: {value}",
    "politics.limit.lawsDirect": "can be enacted directly",
    "politics.limit.lawsVote": "require a vote",
    "politics.limit.noRatification": "without ratification",
    "politics.limit.noThreshold": "no separate threshold",
    "politics.limit.ratificationRequired": "require political ratification",
    "politics.limit.transferThreshold": "from {value} require oversight",
    "politics.limit.transfers": "Large payments: {value}",
    "politics.limit.treaties": "Territorial treaties: {value}",
    "politics.loadFailed": "Failed to load politics",
    "politics.loading": "Loading...",
    "politics.loyalists": "Loy. {value}",
    "politics.noCurrentBills": "Parliament is not considering any laws right now.",
    "politics.noDescription": "No description set.",
    "politics.noGroup": "No group",
    "politics.noInterestGroups": "Create interest groups in the content panel and configure profession weights.",
    "politics.noLawGroups": "Create law groups and laws in the content panel.",
    "politics.none": "none",
    "politics.parliament": "Parliament",
    "politics.parliamentPowers": "Parliament powers",
    "politics.party.government": "Government",
    "politics.party.opposition": "Opposition",
    "politics.partyLabel": "Party: {party}",
    "politics.power.budget.approveBudget": "Approves budget",
    "politics.power.budget.approveTaxes": "Approves taxes",
    "politics.power.budget.controlBudget": "Controls budget",
    "politics.power.diplomacy.ratifyAll": "Ratifies all treaties",
    "politics.power.diplomacy.ratifyMajorTreaties": "Ratifies major treaties",
    "politics.power.diplomacy.ratifyTerritory": "Ratifies territory",
    "politics.power.government.appointGovernment": "Appoints government",
    "politics.power.government.confidenceVote": "Confidence vote",
    "politics.power.laws.advisory": "Advisory voice",
    "politics.power.laws.approve": "Approves laws",
    "politics.power.laws.initiate": "Initiates and approves",
    "politics.power.none": "No role",
    "politics.power.war.approve": "Approves war",
    "politics.power.war.declare": "May declare war",
    "politics.powerDescription.budgetDirect": "Budget decisions stay with the ruler.",
    "politics.powerDescription.budgetVote": "Some budget decisions need political approval.",
    "politics.powerDescription.diplomacyDirect": "Treaties are signed without ratification.",
    "politics.powerDescription.diplomacyVote": "Important treaties may require parliamentary ratification.",
    "politics.powerDescription.governmentDirect": "Government composition does not depend on parliament.",
    "politics.powerDescription.governmentVote": "Parliament affects stability or appointment of government.",
    "politics.powerDescription.lawsDirect": "Laws can be enacted directly. Parliament does not block the decision.",
    "politics.powerDescription.lawsVote": "New laws go through a parliamentary vote.",
    "politics.powerDescription.warDirect": "The ruler decides military matters.",
    "politics.powerDescription.warVote": "Military decisions depend on a parliamentary mandate.",
    "politics.powerDomain.budget": "Budget",
    "politics.powerDomain.diplomacy": "Diplomacy",
    "politics.powerDomain.government": "Government",
    "politics.powerDomain.laws": "Laws",
    "politics.powerDomain.war": "War",
    "politics.preference.against": "against {value}",
    "politics.preference.for": "for {value}",
    "politics.preference.neutral": "neutral",
    "politics.preference.opposes": "Opposes",
    "politics.preference.supports": "Supports",
    "politics.radicals": "Rad. {value}",
    "politics.rawPower": "Power {value}",
    "politics.seatCount": "{seats} seats",
    "politics.seatDistribution": "Seat distribution by party",
    "politics.seats": "seats",
    "politics.selectLaw": "Select a law from the list.",
    "politics.selectedLaw": "Selected law",
    "politics.selectedLawPreference": "Toward selected law: {value}",
    "politics.selectLawForGroups": "Select a law to see group attitudes.",
    "politics.tab.interestGroups": "Interest groups",
    "politics.tab.laws": "Laws",
    "politics.tab.overview": "Overview",
    "politics.tab.parties": "Parties",
    "politics.tab.powers": "Powers",
    "politics.title": "Politics: {country}",
    "politics.vote.abstainCompact": "Abst. {value}",
    "politics.vote.abstainShort": "Abst.",
    "politics.vote.abstainValue": "Abst.: {value}",
    "politics.vote.no": "Against",
    "politics.vote.noCompact": "Against {value}",
    "politics.vote.noValue": "Against: {value}",
    "politics.vote.yes": "For",
    "politics.vote.yesCompact": "For {value}",
    "politics.vote.yesValue": "For: {value}",
    "politics.voteForecast": "Vote forecast: {law}",
    "notifications.history": "Notification History",
    "notifications.new": "New",
    "notifications.openHistory": "Open notification history",
    "notifications.openHistoryDescription": "Open the list of previous notifications",
    "notifications.receivedTurn": "Received turn: {turn}",
    "notifications.registrationRequest": "Registration request: {country}",
    "notifications.requiresDecision": "Requires decision",
    "notifications.total": "Total: {count}",
    "notifications.viewed": "Viewed",
    "provincePanel.collapse": "Collapse panel",
    "provinceTooltip.area": "Area: {area}",
    "provinceTooltip.colonization": "Colonization",
    "provinceTooltip.owner": "Owner: {owner}",
    "provincePanel.pin": "Pin panel",
    "provincePanel.unpin": "Unpin panel",
    "corridorBuild.title": "Corridor construction",
    "corridorBuild.summary": "Route points: {points}. Provinces: {provinces}. Click your provinces to lay the path.",
    "corridorBuild.undoPoint": "Remove point",
    "colonization.title": "Colonization: {region}",
    "colonization.fallbackRegion": "Region",
    "colonization.area": "Area: {area}",
    "colonization.showOwnColonies": "Show data for our colony",
    "colonization.selectRegion": "Select region",
    "colonization.cost": "Colonization cost",
    "colonization.ducatsByArea": "Ducat price by area:",
    "colonization.status": "Status:",
    "colonization.statusOccupied": "occupied ({country})",
    "colonization.statusDisabled": "disabled",
    "colonization.statusAvailable": "available",
    "colonization.regionArea": "Region area: {area}",
    "colonization.yourProgress": "Your progress: {progress} / {cost}",
    "colonization.limitTooltip": "Your country's active colonization limit: current active colonies / game maximum",
    "colonization.limit": "Colonization limit",
    "colonization.raceLeader": "Race leader",
    "colonization.noParticipants": "No participants",
    "colonization.disabledByAdmin": "Colonization disabled by an administrator",
    "colonization.participants": "Race participants",
    "colonization.noColonizers": "No country is colonizing this region yet",
    "colonization.openAdminEditor": "Open region data editor (admin only)",
    "colonization.openAdminEditorAria": "Edit region (admin)",
    "colonization.cancelTooltipCan": "Stop your country's participation in this region's colonization",
    "colonization.cancelTooltipCannot": "Your country has no active colonization in this region",
    "colonization.cancel": "Cancel colonization",
    "colonization.startTooltipCan": "Start colonization: the region will be added to your country's active colonies",
    "colonization.startTooltipCannot": "Colonization cannot be started now; check status and limits",
    "colonization.start": "Start colonization",
    "colonization.toastStarted": "Colonization started",
    "colonization.eventStartTitle": "Colonization started",
    "colonization.eventStartMessage": "You started colonizing region {region}",
    "colonization.limitReached": "Active colonization limit reached",
    "colonization.eventLimitTitle": "Colonization limit",
    "colonization.startFailed": "Failed to start colonization",
    "colonization.toastCanceled": "Colonization canceled",
    "colonization.eventCancelTitle": "Colonization canceled",
    "colonization.eventCancelMessage": "You canceled colonization of region {region}",
    "colonization.cancelFailed": "Failed to cancel colonization",
    "diplomacy.transferRegion": "Region transfer",
    "diplomacy.transferRegionSummary": "{from} transfers region {region} to {to}",
    "diplomacy.regionNotOwned": "The sender no longer owns this region",
    "diplomacy.selectRegion": "Select region",
    "diplomacy.accept": "Sign",
    "diplomacy.activeTab": "Active treaties",
    "diplomacy.addClauseFromColumn": "Add a clause from the {side} column.",
    "diplomacy.addTreatyClauses": "Add treaty clauses",
    "diplomacy.articleSuffix": "articles",
    "diplomacy.categoryEconomy": "Economy",
    "diplomacy.categoryInfrastructure": "Infrastructure",
    "diplomacy.categoryOther": "Other",
    "diplomacy.categoryTerritory": "Territory",
    "diplomacy.clauseConstructionRights": "Corridor construction",
    "diplomacy.clauseOutsideParties": "A clause references a country outside the treaty",
    "diplomacy.clauseTextNote": "Text clause",
    "diplomacy.clauseTransferMoney": "Money transfer",
    "diplomacy.clauseTransit": "Infrastructure transit",
    "diplomacy.constructionExpiration": "What happens after the treaty ends",
    "diplomacy.countrySelect": "Select country",
    "diplomacy.createOrCheckOtherTab": "Create a new treaty or check another tab.",
    "diplomacy.declineRenewal": "Do not renew",
    "diplomacy.diplomaticAgreement": "Diplomatic agreement",
    "diplomacy.durationActive": "Active for {turns} turns.",
    "diplomacy.durationLabel": "Duration",
    "diplomacy.edit": "Edit",
    "diplomacy.editingAgreement": "Diplomatic agreement revision",
    "diplomacy.emptyList": "No treaties here yet.",
    "diplomacy.expiredRenewal": "Term ended. Accepted: {count}/2",
    "diplomacy.fillClauses": "Fill in the treaty clauses",
    "diplomacy.insufficientFunds": "One side does not have enough money",
    "diplomacy.incomingTab": "Incoming",
    "diplomacy.initiator": "Initiator",
    "diplomacy.loadFailed": "Failed to load diplomacy",
    "diplomacy.negotiationMeta": "Negotiations: revision {revision}. Response turn: {responder}.",
    "diplomacy.newAgreement": "New treaty",
    "diplomacy.noResponder": "none",
    "diplomacy.ourArticles": "Our",
    "diplomacy.ourConditions": "Our terms",
    "diplomacy.outgoingTab": "Outgoing",
    "diplomacy.partyOurs": "Your side",
    "diplomacy.partyTheirs": "Second side",
    "diplomacy.paymentOnce": "once",
    "diplomacy.paymentPerTurn": "per turn",
    "diplomacy.policyDisableWithoutTransit": "Disable without transit",
    "diplomacy.policyDisableWithoutTransitDescription": "Built segments remain with the builder, but stop working without transit.",
    "diplomacy.policyNationalize": "Nationalize",
    "diplomacy.policyNationalizeDescription": "After the treaty ends, the corridor transfers to the territory owner.",
    "diplomacy.proposalName": "Treaty name",
    "diplomacy.proposalNamePlaceholder": "Default: numbered treaty",
    "diplomacy.reject": "Reject",
    "diplomacy.rejectFailed": "Failed to reject treaty",
    "diplomacy.rejected": "Treaty rejected",
    "diplomacy.responder": "Responder",
    "diplomacy.renew": "Renew",
    "diplomacy.renewAccepted": "Treaty renewed",
    "diplomacy.renewDeclined": "Renewal rejected",
    "diplomacy.renewDeclineFailed": "Failed to reject renewal",
    "diplomacy.renewFailed": "Failed to renew treaty",
    "diplomacy.renewSent": "Renewal consent sent",
    "diplomacy.selectOtherPartyFirst": "Select the treaty's second party first",
    "diplomacy.selectCountryForTreaty": "Select a country for the treaty",
    "diplomacy.selectClauseFromSides": "Choose a clause on the left or right to assemble the proposal.",
    "diplomacy.selectTargetCountry": "Select the second party",
    "diplomacy.sendFailed": "Failed to send treaty",
    "diplomacy.sendTooltip": "Sends the treaty to the second party immediately, without saving a draft.",
    "diplomacy.submitAgreement": "Send treaty",
    "diplomacy.submitRevision": "Return with new terms",
    "diplomacy.sent": "Treaty sent",
    "diplomacy.signed": "Treaty signed",
    "diplomacy.signFailed": "Failed to sign treaty",
    "diplomacy.storyActionFailed": "Failed to process treaty",
    "diplomacy.storyArticle": "Article {number}",
    "diplomacy.storyArticles": "Treaty articles",
    "diplomacy.storyArticlesCount": "{count} clauses",
    "diplomacy.storyDefaultTitle": "Diplomatic treaty",
    "diplomacy.storyExpires": "until turn {turn}",
    "diplomacy.storyLoading": "Loading treaty",
    "diplomacy.storyLoadingDescription": "Opening terms from the notification.",
    "diplomacy.storyNegotiationChain": "Negotiation chain",
    "diplomacy.storyPendingAccept": "Signing...",
    "diplomacy.storyPendingReject": "Rejecting...",
    "diplomacy.storyRevision": "Revision {revision}: {from} -> {to}, turn {turn}",
    "diplomacy.storyRevisionHistory": "Revision",
    "diplomacy.storySubtitle": "Revision {revision} · turn {from}-{to}",
    "diplomacy.storyVersion": "Version",
    "diplomacy.storyVersionRange": "version {revision}",
    "diplomacy.storyYourTurnFailed": "It is not your turn to respond",
    "diplomacy.status.accepted": "Signed",
    "diplomacy.status.expired": "Expired",
    "diplomacy.status.failed": "Failed",
    "diplomacy.status.pending": "Awaiting signature",
    "diplomacy.status.rejected": "Rejected",
    "diplomacy.status.renewalPending": "Awaiting renewal",
    "diplomacy.statusLine": "{status} · turn {from} - {to}",
    "diplomacy.title": "Diplomacy",
    "diplomacy.subtitle": "Treaty builder between live players",
    "diplomacy.summaryConstructionRights": "{from} allows {to} to build corridors: {modes}. After expiration: {policy}",
    "diplomacy.summaryMoney": "{from} transfers {to} {amount} {resource} {cadence}",
    "diplomacy.summaryTransit": "{from} grants {to} transit: {modes}",
    "diplomacy.textNotePlaceholder": "For example: the parties agree not to interfere with colonization of the region...",
    "diplomacy.theirArticles": "Their articles",
    "diplomacy.theirConditions": "Second side terms",
    "diplomacy.transportAir": "Air",
    "diplomacy.transportLand": "Land transport",
    "diplomacy.transportModes": "Transport types",
    "diplomacy.transportPipeline": "Pipelines",
    "diplomacy.transportPowerGrid": "Power grids",
    "diplomacy.transportSea": "Sea",
    "diplomacy.secondParty": "Second party",
    "diplomacy.resourceDucats": "Ducats",
    "diplomacy.resourceGold": "Gold",
    "diplomacy.leftSide": "left",
    "diplomacy.rightSide": "right",
    "diplomacy.updateSent": "New treaty version sent",
    "diplomacy.waitingOtherSide": "Waiting for the other side",
    "market.alerts": "Alerts",
    "market.critical": "Critical",
    "market.criticalGoodsTooltip": "Goods with demand coverage below 50%.",
    "market.countryDescription": "Our market ({country})",
    "market.countryTab": "Our market",
    "market.emptyRows": "No data matches the selected filters.",
    "market.globalDescription": "Global market",
    "market.globalTab": "Global",
    "market.good": "Good",
    "market.goodCatalogTooltip": "Good from the content catalog.",
    "market.goodsInSelectionTooltip": "Goods in the current table selection.",
    "market.history": "Good history",
    "market.historyTooltip": "Historical series for the selected good over recent turns.",
    "market.inviteAccepted": "Invite accepted",
    "market.inviteRejected": "Invite rejected",
    "market.inviteFailed": "Failed to process invite",
    "market.joined": "Joined market",
    "market.joinFailed": "Failed to join market",
    "market.joinRequestSent": "Join request sent",
    "market.leaveFailed": "Failed to leave market",
    "market.left": "Left market",
    "market.management": "Management",
    "market.membership": "Membership",
    "market.metric.coverage": "Coverage",
    "market.metric.demand": "Demand",
    "market.metric.offer": "Offer",
    "market.metric.price": "Unit price",
    "market.metric.productionFact": "Production actual",
    "market.metric.productionMax": "Production max",
    "market.noSelectedGood": "Select a good in the table.",
    "market.other": "Other",
    "market.recentTurns": "{good} · last {turns} turns",
    "market.sanctions": "Sanctions",
    "market.sortDeficit": "Sort: deficit",
    "market.sortPrice": "Sort: price",
    "market.sortVolatility": "Sort: volatility",
    "market.title": "Market",
    "market.tradePartners": "Trade partners",
    "market.turnLabel": "Turn {turn}",
    "market.pointLabel": "Point {point}",
    "market.importCountriesTop": "Imports from countries (top 10)",
    "market.importMarketsTop": "Imports from markets (top 10)",
    "market.exportCountriesTop": "Exports to countries (top 10)",
    "market.exportMarketsTop": "Exports to markets (top 10)",
    "market.all": "All",
    "market.accept": "Accept",
    "market.actionColumn": "Action",
    "market.addGood": "Add good",
    "market.addRuleEmpty": "Add at least one good row.",
    "market.alertsDescription": "Shortage, overload, and inactive-building events",
    "market.alertsTitle": "Market alerts",
    "market.allGoods": "All goods",
    "market.apply": "Apply",
    "market.applyAll": "Apply to all",
    "market.applyPackage": "Apply package",
    "market.bulkDirectionTooltip": "Apply this direction to every row.",
    "market.bulkModeTooltip": "Apply this mode to every row.",
    "market.cancelInvite": "Cancel",
    "market.capColumn": "Limit",
    "market.confirmationTitle": "Confirmation",
    "market.countrySearch": "Search country",
    "market.delete": "Delete",
    "market.directionBoth": "Import+Export",
    "market.directionColumn": "Direction",
    "market.directionExport": "Export",
    "market.directionImport": "Import",
    "market.directionShortBoth": "Imp+Exp",
    "market.disable": "Disable",
    "market.durationPlaceholder": "Duration (turns)",
    "market.durationTooltip": "How many turns the rule stays active.",
    "market.enable": "Enable",
    "market.filterNoResults": "Nothing found for this filter.",
    "market.fromLabel": "From: {country}",
    "market.goodColumn": "Good",
    "market.incomingInvites": "Incoming invites",
    "market.inviteCancelFailed": "Failed to cancel invite",
    "market.inviteCanceled": "Invite canceled",
    "market.inviteSendFailed": "Failed to send invite",
    "market.inviteSent": "Invite sent",
    "market.inviteStatusExpires": "Status: {status} · Expires: {date}",
    "market.joinMarket": "Join",
    "market.joinRequestAlreadySent": " · Request already sent",
    "market.leaveMarket": "Leave market",
    "market.limitWithAmount": "Limit {amount}",
    "market.loading": "Loading...",
    "market.logo": "Logo",
    "market.managementDescription": "Market settings, outgoing invites, and ownership transfer",
    "market.managementLoadFailed": "Failed to load market management",
    "market.managementOwnerOnly": "Only the market owner can manage this market.",
    "market.managementTitle": "Market management",
    "market.marketNotFound": "Market not found or inaccessible.",
    "market.membershipDescription": "Current market information and leaving controls",
    "market.membershipHint": "Public market: immediate join. Private market: request goes to the owner.",
    "market.membershipTitle": "Current membership",
    "market.modeBan": "Ban",
    "market.modeCap": "Limit",
    "market.modeColumn": "Mode",
    "market.nameLabel": "Name",
    "market.noAlerts": "No alerts.",
    "market.noInvites": "No invites.",
    "market.noOutgoingInvites": "No outgoing invites yet.",
    "market.noValidSanctionRules": "No valid rules to apply",
    "market.notMember": "Your country is not a member of any market.",
    "market.outgoingInvites": "Outgoing invite history",
    "market.ownerChanged": "Market owner changed",
    "market.ownerLabel": "Owner: {country}",
    "market.ownerWarningBody": "Transfer market ownership in the Management modal before leaving.",
    "market.ownerWarningTitle": "You own this market",
    "market.period": "Period: {from}-{to}",
    "market.reject": "Reject",
    "market.ruleCapRequired": "Limit > 0",
    "market.ruleGoodRequired": "Select a good",
    "market.sanctionApplyFailed": "Failed to apply sanctions",
    "market.sanctionBuilder": "Sanction builder",
    "market.sanctionBuilderDescription": "Choose a target, goods, and restriction mode",
    "market.sanctionDeleted": "Sanction deleted",
    "market.sanctionDeleteFailed": "Failed to delete sanction",
    "market.sanctionList": "Sanction list",
    "market.sanctionsAdded": "Sanctions added: {count}",
    "market.sanctionsDescription": "Import/export rule builder with bulk application",
    "market.sanctionsListDescription": "Active and completed market restrictions",
    "market.sanctionsListTitle": "Sanctions",
    "market.sanctionsLoadFailed": "Failed to load sanctions",
    "market.sanctionsOwnerOnly": "Only the market owner can change sanctions.",
    "market.sanctionsTitle": "Market sanctions",
    "market.sanctionUpdateFailed": "Failed to update sanction",
    "market.save": "Save",
    "market.selectCountry": "Select country",
    "market.selectedMarketSummary": "Owner: {owner} · Members: {members}{pending}",
    "market.selectMarket": "Select market",
    "market.selectNewOwner": "Select new owner",
    "market.selectTarget": "Select target",
    "market.sendInvite": "Send invite",
    "market.sendInviteTooltip": "Send a market invite",
    "market.sendRequest": "Send request",
    "market.settingsSection": "Market settings",
    "market.statusActive": "ACTIVE",
    "market.statusAll": "All",
    "market.statusExpired": "EXPIRED",
    "market.statusPaused": "PAUSED",
    "market.stepConfirm": "3. Confirm",
    "market.stepGoods": "2. Goods",
    "market.stepTarget": "1. Target",
    "market.targetCountry": "Country",
    "market.targetLabel": "Target: {target}",
    "market.targetMarket": "Market",
    "market.targetSelectTooltip": "Specific sanction target.",
    "market.targetTypeCountry": "Target: country",
    "market.targetTypeMarket": "Target: market",
    "market.targetTypeTooltip": "Sanction a country or an entire market.",
    "market.targetValue": "{type}: {target}",
    "market.transfer": "Transfer",
    "market.transferFailed": "Failed to transfer ownership",
    "market.transferOwnership": "Transfer market ownership",
    "market.transferOwnerTooltip": "Transfer management rights to the selected country",
    "market.turnsLeft": "{turns} turns left",
    "market.updateFailed": "Failed to update market",
    "market.updateSuccess": "Market settings updated",
    "market.visibilityLabel": "Visibility",
    "market.visibilityMembers": "Visibility: {visibility} · Members: {members}",
    "market.visibilityPrivate": "Private",
    "market.visibilityPublic": "Public",
    "market.worldMarkets": "World markets",
    "population.countryTitle": "Population: {country}",
    "population.worldTitle": "World population",
    "population.countryRegionSubtitle": "Statistics for your regions",
    "population.worldRegionSubtitle": "Summary statistics for all regions",
    "population.groupsByRegion": "Pop groups by region",
    "population.regionColumn": "Region",
    "population.regionsInScope": "Regions in calculation",
    "population.noNegativeRegionBalance": "No regions with negative balance for {turns} consecutive turns",
    "population.negativeRegionBalanceAlert": "{region}: negative balance for {turns} consecutive turns ({balance} ducats/turn)",
    "population.noLowRegionCapital": "No regions with critically low capital per capita",
    "population.lowRegionCapitalAlert": "{region}: low capital per capita ({capital} ducats/person)",
    "population.aggregatedData": "Aggregated population data",
    "population.balance": "Balance",
    "population.brandingDescription": "Preparation for population panel visual settings",
    "population.brandingTitle": "Logo and style",
    "population.births": "Births",
    "population.birthsDeaths": "Births / deaths",
    "population.birthsDeathsShort": "Births/Deaths",
    "population.budgetEnough": "Population budget is sufficient",
    "population.categoryBasic": "Basic",
    "population.categoryComfort": "Comfort",
    "population.categoryLuxury": "Luxury",
    "population.categorySurvival": "Survival",
    "population.categoryColumn": "Category",
    "population.comfortShort": "Comfort",
    "population.coverage": "Coverage",
    "population.cultureColumn": "Culture",
    "population.deaths": "Deaths",
    "population.dimensionCultures": "Cultures",
    "population.dimensionIdeologies": "Ideologies",
    "population.dimensionProfessions": "Professions",
    "population.dimensionRaces": "Races",
    "population.dimensionReligions": "Religions",
    "population.ducats": "ducats",
    "population.dominantReligion": "Dominant religion",
    "population.expenseColumn": "Expense",
    "population.financeDescription": "Population treasury, income/expenses per turn, and risk signals",
    "population.financeAlerts": "Signals (alerts)",
    "population.financeTitle": "Population finance",
    "population.flowGoodsExpense": "Population goods purchases",
    "population.flowOtherExpense": "Other expenses",
    "population.flowOtherIncome": "Other sources",
    "population.flowTaxes": "Taxes/fees",
    "population.flowTransfers": "Social payments/transfers",
    "population.flowWages": "Building wages",
    "population.incomePerTurn": "Population income per turn",
    "population.incomeStructure": "Income structure",
    "population.largestCulture": "Largest culture",
    "population.lastTurnChange": "Change over last turn",
    "population.legendCount": "Legend ({count})",
    "population.loyalists": "Loyalists",
    "population.marketDeficitGoods": "Market goods shortages",
    "population.marketGoodsAvailable": "Market goods are broadly available",
    "population.needBudgetShortage": "Money shortage for needs",
    "population.netBalance": "Net balance",
    "population.noData": "No data",
    "population.openTabPrompt": "Open the {tab} tab for detailed statistics.",
    "population.panelTitle": "Population panel",
    "population.peopleCount": "{count} people",
    "population.popGroupsDescription": "Identity groups: culture, religion, race, and aggregates across internal professions",
    "population.popGroupsTitle": "Pop groups",
    "population.professionColumn": "Profession",
    "population.professionNeedsDescription": "Category coverage, shortage goods, SoL, and demographics by professions inside pop groups",
    "population.professionNeedsTitle": "Professions and needs",
    "population.professionsByPopGroups": "Professions by pop group",
    "population.professionsShort": "Prof.",
    "population.raceColumn": "Race",
    "population.radicals": "Radicals",
    "population.radicalsLoyalists": "Radicals / loyalists",
    "population.radicalsLoyalistsShort": "Rad./Loyal.",
    "population.religionColumn": "Religion",
    "population.required": "Required",
    "population.scope": "Scope",
    "population.scopeCountry": "Country",
    "population.scopeWorld": "World",
    "population.sectionBranding": "Logo and style",
    "population.sectionCultures": "Cultures",
    "population.sectionFinance": "Population finance",
    "population.sectionGeneral": "Overview",
    "population.sectionGroups": "Groups",
    "population.sectionIdeologies": "Ideologies",
    "population.sectionNeeds": "Needs",
    "population.sectionProfessions": "Professions",
    "population.sectionRaces": "Races",
    "population.sectionReligions": "Religions",
    "population.status": "Status",
    "population.satisfactionShort": "Satisf.",
    "population.sizeColumn": "Size",
    "population.survivalShort": "Surv.",
    "population.totalCapital": "Total population capital",
    "population.totalExpenses": "Population expenses per turn",
    "population.totalPopulation": "Total population",
    "population.visualReserved": "This section is reserved for future population visualization mechanics.",
    "population.expenseStructure": "Expense structure",
    "population.fulfilled": "Fulfilled",
    "population.groupColumn": "Group",
    "population.wallet": "Wallet",
    "buildings.regionRequired": "No region selected",
    "buildings.regionDependency": "Requires building in region: {building}",
    "buildings.ownRegionOnlyDemolish": "Demolition is available only in your regions",
    "buildings.ownRegionOnlyUpgrade": "Upgrade is available only in your regions",
    "buildings.ownRegionOnlyToggle": "This toggle is available only in your regions",
    "buildings.ownRegionOnlyRename": "Renaming is available only in your regions",
    "buildings.duplicateNameInRegion": "That name is already used in this region",
    "buildings.modalDescription": "All constructed buildings by region",
    "buildings.sortRegion": "Sort: region",
    "buildings.filterRegionAll": "Region: all",
    "buildings.regionLabel": "Region:",
    "buildings.extractedResourceTooltip": "Resource extracted by the building from region deposits this turn",
    "buildings.buildCountryTooltip": "Country whose regions will receive planned construction. Your country is selected by default.",
    "buildings.selectedRegionTooltip": "The selected region applies to every project added from the list below.",
    "buildings.selectedRegionLabel": "Region",
    "buildings.selectRegion": "Select region",
    "buildings.confirmRegion": "Region:",
    "buildings.renamePrompt": "Building: {building}\nRegion: {region}",
    "buildings.filterActivityActive": "Activity: active",
    "buildings.filterActivityAll": "Activity: all",
    "buildings.filterActivityInactive": "Activity: inactive",
    "buildings.filterBuildingAll": "Building: all",
    "buildings.filterCompanyAll": "Company: all",
    "buildings.filterCompanyCountryAll": "Company country: all",
    "buildings.filterEconomyAll": "Economy: all",
    "buildings.filterEconomyLoss": "Loss-making",
    "buildings.filterEconomyProfit": "Profitable",
    "buildings.filterIndustryAll": "Industry: all",
    "buildings.filterSectorAll": "Sector: all",
    "buildings.filterStatusAll": "Status: all",
    "buildings.filterStatusBuilt": "Built",
    "buildings.filterStatusConstruction": "Under construction",
    "buildings.filters": "Filters",
    "buildings.industryTitle": "Industry",
    "buildings.openConstruction": "Open construction",
    "buildings.regionCounts": "Built: {built}, queued: {queued}",
    "buildings.resetFilters": "Reset filters",
    "buildings.sortBuilding": "Sort: building",
    "buildings.sortCompany": "Sort: company",
    "buildings.sortIndustry": "Sort: industry",
    "buildings.sortSector": "Sort: sector",
    "buildings.addToQueueTitle": "Add {building} to the construction queue",
    "buildings.addBuildingCta": "Add building",
    "buildings.addBuildingHint": "Quick jump to construction",
    "buildings.available": "Available",
    "buildings.availableBuildings": "Available buildings",
    "buildings.availableConstructionTooltip": "Country construction points.",
    "buildings.availableDucatsTooltip": "Country ducats.",
    "buildings.availableConstruction": "Available",
    "buildings.buildingDescriptionMissing": "No building description.",
    "buildings.buildingInactive": "Building is inactive",
    "buildings.buildingCash": "Building cash",
    "buildings.buildingCashTooltip": "Money accumulated by the building",
    "buildings.buildingFallbackName": "Building",
    "buildings.buildingLabel": "Building:",
    "buildings.buildCountry": "Construction country",
    "buildings.cancelPendingProjectTooltip": "Cancel the project before the current turn resolves",
    "buildings.cancelQueuedProjectTooltip": "Remove the project from the construction queue",
    "buildings.cancelConstructionTitle": "Cancel construction?",
    "buildings.cancelConstructionTooltip": "Cancel construction",
    "buildings.constructionCost": "Construction cost",
    "buildings.constructionParameters": "Construction parameters",
    "buildings.constructionPointsUnit": "construction points",
    "buildings.constructionProgress": "Progress: {value}%",
    "buildings.constructionQueue": "Construction queue",
    "buildings.constructionQueueEmpty": "The queue is empty",
    "buildings.constructionQueueTooltip": "Projects in the construction queue, including pending current-turn orders.",
    "buildings.constructionTitle": "Construction",
    "buildings.consumes": "Consumes",
    "buildings.costLabel": "Cost:",
    "buildings.countryLabel": "Country:",
    "buildings.countryDenied": "Country is denied",
    "buildings.countryLimitReached": "Country limit reached ({current}/{limit})",
    "buildings.countryNotAllowed": "Country is not allowed",
    "buildings.customNameLabel": "Name:",
    "buildings.customNameMissing": "not set",
    "buildings.demolishBuildingTitle": "Demolish building?",
    "buildings.demolishConstructionCost": "Demolition cost:",
    "buildings.demolishTooltip": "Demolish the building completely. Costs construction points.",
    "buildings.disableAutoUpgradeTooltip": "Disable building-funded auto-upgrade",
    "buildings.disableManualWorkTooltip": "Disable building manually",
    "buildings.disableSubsidiesTooltip": "Disable state subsidies",
    "buildings.durabilityLabel": "Durability: {value}%",
    "buildings.durabilityTooltip": "Durability: {value}%. Limits the building's maximum productivity.",
    "buildings.enableAutoUpgradeTooltip": "Enable building-funded auto-upgrade",
    "buildings.enableManualWorkTooltip": "Enable building manually",
    "buildings.enableSubsidiesTooltip": "Enable state subsidies",
    "buildings.extraction": "extraction",
    "buildings.fertility": "fertility",
    "buildings.finance": "Finance",
    "buildings.financeGoodsPurchase": "Goods purchase",
    "buildings.financeUpgrade": "Level upgrade",
    "buildings.factualAmount": "Actual: {value}",
    "buildings.globalLimitReached": "Global limit reached ({current}/{limit})",
    "buildings.inputGoodsCost": "Input goods",
    "buildings.inputGoodTooltip": "Input good purchased by the building for production",
    "buildings.inputCostTooltip": "Input good purchase cost this turn",
    "buildings.industryDescriptionMissing": "No industry description.",
    "buildings.industryLabel": "Industry:",
    "buildings.inactiveLabel": "Inactive",
    "buildings.inactiveLossNotCovered": "Not enough ducats: the loss is not covered by building cash",
    "buildings.instanceMissing": "Building instance not found",
    "buildings.levelLabel": "Level:",
    "buildings.limitingFactor": "Limit: {factor} {value}%",
    "buildings.limitingFactorLabel": "Limiting factor: {factor} ({value}%)",
    "buildings.limitingFactor.durability": "durability",
    "buildings.limitingFactor.extraction": "extraction",
    "buildings.limitingFactor.finance": "finance",
    "buildings.limitingFactor.infrastructure": "infrastructure",
    "buildings.limitingFactor.inputs": "input goods",
    "buildings.limitingFactor.labor": "labor",
    "buildings.manualDisabledReason": "Manually disabled",
    "buildings.maxAmount": "Maximum: {value}",
    "buildings.maxDurability": "Durability",
    "buildings.maxLevel": "Max level",
    "buildings.netPerTurn": "Net per turn",
    "buildings.netPerTurnTooltip": "Building financial result this turn, profit or loss",
    "buildings.noExtraction": "No extraction",
    "buildings.noInputs": "No input goods",
    "buildings.noOutputs": "No output goods",
    "buildings.otherIndustry": "Other",
    "buildings.owner": "Owner",
    "buildings.ownerCompany": "Company",
    "buildings.ownerCompanyMissing": "No owner company selected",
    "buildings.ownerCompanyDescriptionMissing": "No company description.",
    "buildings.ownerCompanyLabel": "Owner company",
    "buildings.ownerCompanyTooltip": "Company that will own the project when owner type is Company.",
    "buildings.ownerCountry": "Owner country",
    "buildings.ownerCountryTooltip": "Country that will own the project when owner type is State.",
    "buildings.ownerState": "State",
    "buildings.ownerType": "Owner",
    "buildings.ownerTypeTooltip": "Who will own each added building: the state or a company.",
    "buildings.project": "Project",
    "buildings.productivityLabel": "Productivity: {value}%",
    "buildings.productivityMetric": "Productivity",
    "buildings.productivityTooltip": "Productivity: {value}%. Shows what share of maximum capacity the building works this turn.",
    "buildings.produces": "Produces",
    "buildings.production": "Production",
    "buildings.outputGoodTooltip": "Output good produced by the building",
    "buildings.outputIncomeTooltip": "Output good sales revenue this turn",
    "buildings.projectBuild": "New building",
    "buildings.projectUpgrade": "Level upgrade",
    "buildings.requirements": "Requirements",
    "buildings.requirementsCannotAdd": "No {reason}",
    "buildings.requirementsCanAdd": "Yes, can add to construction queue",
    "buildings.requiresDeposit": "requires deposit",
    "buildings.requiredTechnology": "Requires technology: {technology}",
    "buildings.regionFiltersEmpty": "No regions match the selected filters.",
    "buildings.renameBuildingHint": "Empty value resets the custom name",
    "buildings.renameBuildingLabel": "Custom name, up to 80 characters",
    "buildings.renameBuildingPlaceholder": "Enter a custom name",
    "buildings.renameBuildingTitle": "Rename building",
    "buildings.renameSave": "Save",
    "buildings.renameTooltip": "Change the building's custom name",
    "buildings.sectorDescriptionMissing": "No sector description.",
    "buildings.sectorLabel": "Sector:",
    "buildings.salesRevenue": "Sales revenue",
    "buildings.selectCompany": "Select company",
    "buildings.selectCountry": "Select country",
    "buildings.startingCapital": "Starting capital",
    "buildings.statuses": "Statuses",
    "buildings.stateSubsidies": "State subsidies",
    "buildings.stateSubsidiesTooltip": "State subsidies received by the building this turn",
    "buildings.stock": "Stock",
    "buildings.stockAvailable": "Available: {value}",
    "buildings.stockEmpty": "empty",
    "buildings.stockIncoming": "Incoming: {value}",
    "buildings.stockOutgoing": "Outgoing: {value}",
    "buildings.stockRemainder": "Remainder: {value}",
    "buildings.statusStopped": "Stopped",
    "buildings.statusWorking": "Working",
    "buildings.toastAutoUpgradeDisabled": "Building-funded auto-upgrade disabled",
    "buildings.toastAutoUpgradeEnabled": "Building-funded auto-upgrade enabled",
    "buildings.toastAutoUpgradeFailed": "Failed to change auto-upgrade mode",
    "buildings.toastBuildCancelFailed": "Failed to cancel construction",
    "buildings.toastBuildCanceled": "Construction canceled",
    "buildings.toastBuildNotFound": "Project was not found",
    "buildings.toastDemolishFailed": "Failed to demolish building",
    "buildings.toastDemolished": "Building demolished ({cost} construction points)",
    "buildings.toastDemolishInsufficientConstruction": "Not enough construction points to demolish",
    "buildings.toastDemolishNotFound": "Building is already missing",
    "buildings.toastManualWorkDisabled": "Building manually disabled",
    "buildings.toastManualWorkEnabled": "Building manually enabled",
    "buildings.toastManualWorkFailed": "Failed to change manual building mode",
    "buildings.toastRenameFailed": "Failed to update building name",
    "buildings.toastRenameReset": "Building name reset",
    "buildings.toastRenameUpdated": "Building name updated",
    "buildings.toastSubsidiesDisabled": "State subsidies disabled",
    "buildings.toastSubsidiesEnabled": "State subsidies enabled",
    "buildings.toastSubsidiesFailed": "Failed to change subsidy mode",
    "buildings.toastUpgradeAlreadyQueued": "This building upgrade is already queued",
    "buildings.toastUpgradeFailed": "Failed to queue upgrade",
    "buildings.toastUpgradeInsufficientDucats": "Not enough state ducats for upgrade",
    "buildings.toastUpgradeMaxReached": "Building is already at maximum level",
    "buildings.toastUpgradeQueued": "Upgrade queued: Lv. {current} -> {target}",
    "buildings.tradeAmount": "Amount: {value}",
    "buildings.tradeBuyTooltip": "Input goods purchased this turn",
    "buildings.tradeEmpty": "empty",
    "buildings.tradeExpense": "Expense: {value} ducats",
    "buildings.tradeExpenseTooltip": "Purchase expense this turn",
    "buildings.tradeIncome": "Income: {value} ducats",
    "buildings.tradeIncomeTooltip": "Sales income this turn",
    "buildings.tradeSellTooltip": "Output goods sold this turn",
    "buildings.tradeTurn": "Trade this turn",
    "buildings.unavailable": "Unavailable",
    "buildings.upgradeAlreadyQueuedReason": "Upgrade already queued",
    "buildings.upgradeBlockedTooltip": "Cannot upgrade: {reason}",
    "buildings.upgradeByStateTooltip": "Upgrade with state funds ({construction} construction, {ducats} ducats)",
    "buildings.upgradeDucatsNeeded": "Needs ducats: {value}",
    "buildings.upgradeMaxReached": "Maximum reached: Lv. {level}",
    "buildings.wages": "Wages",
    "buildings.workforce": "Workforce",
    "buildings.workersLabel": "Workers:",
    "budget.category.baseIncome": "State base income",
    "budget.category.colonization": "Colonization support",
    "budget.category.construction": "Construction projects",
    "budget.category.customization": "Country customization",
    "budget.category.provinceRename": "Province renaming",
    "budget.category.subsidies": "State subsidies",
    "budget.chart.expenses": "Expenses",
    "budget.chart.expensesByCategory": "Expenses by category chart",
    "budget.chart.income": "Income",
    "budget.chart.incomeByCategory": "Income by category chart",
    "budget.history.expenses": "Expenses",
    "budget.history.income": "Income",
    "budget.history.net": "Net",
    "budget.history.projected": "Projected",
    "budget.history.treasury": "Treasury",
    "budget.metric.currentTreasury": "Treasury now",
    "budget.metric.net": "Net: {value}",
    "budget.metric.projectedEnd": "Projected turn end",
    "budget.metric.turnExpenses": "Turn expenses",
    "budget.metric.turnIncome": "Turn income",
    "budget.subsidies.empty": "No subsidies were paid this turn.",
    "budget.subsidies.paidThisTurn": "Subsidies paid this turn",
    "budget.subsidies.region": "Region ID: {region}",
    "budget.tab.expenses": "Expenses",
    "budget.tab.history": "History",
    "budget.tab.subsidies": "Subsidies",
    "budget.tab.summary": "Summary",
    "budget.table.amount": "Amount",
    "budget.table.category": "Category",
    "budget.table.expensesByCategory": "Expenses by category",
    "budget.table.incomeByCategory": "Income by category",
    "budget.title": "State Ducat Budget",
    "budget.total.expenses": "Total expenses",
    "budget.total.income": "Total income",
    "provinceContext.openColonization": "Open colonization",
    "provinceContext.openProvinceKnowledge": "Province article",
    "provinceContext.createProvinceKnowledge": "Create province article",
    "provinceContext.openAdminEditor": "Province management",
    "shell.action.army": "Command army",
    "shell.action.armyDescription": "Open formations, routes, and military orders.",
    "shell.action.budget": "State budget",
    "shell.action.budgetDescription": "Review treasury pressure, subsidies, and current-turn expenses.",
    "shell.action.buildings": "Regional construction",
    "shell.action.buildingsDescription": "Open the selected region's buildings and construction queue.",
    "shell.action.customization": "Country identity",
    "shell.action.customizationDescription": "Edit name, colors, flag, and crest.",
    "shell.action.decisions": "Decisions",
    "shell.action.decisionsDescription": "Review available country decisions.",
    "shell.action.diplomacy": "Diplomatic map",
    "shell.action.diplomacyDescription": "Open relations, proposals, and diplomatic actions.",
    "shell.action.events": "Story feed",
    "shell.action.eventsDescription": "Open pending events and the country's narrative record.",
    "shell.action.globalMarket": "Global market",
    "shell.action.globalMarketDescription": "Compare goods and prices across the world.",
    "shell.action.market": "Country market",
    "shell.action.marketDescription": "Review goods, prices, shortages, and trade pressure.",
    "shell.action.modifiers": "Modifiers",
    "shell.action.modifiersDescription": "Inspect active country effects and their sources.",
    "shell.action.politics": "Politics",
    "shell.action.politicsDescription": "Open parliament, laws, and governing structure.",
    "shell.action.population": "Society dashboard",
    "shell.action.populationDescription": "Inspect population, professions, culture, religion, and growth.",
    "shell.action.technology": "Technology",
    "shell.action.technologyDescription": "Open research, progress, and prerequisites.",
    "shell.action.turnStatus": "Country readiness",
    "shell.action.turnStatusDescription": "Review who is ready to resolve the current turn.",
    "shell.admin": "Admin",
    "shell.adminConsole": "Operator console",
    "shell.adminPanel": "Admin panel",
    "shell.availableActions": "Available actions",
    "shell.clientSettings": "Client settings",
    "shell.codex": "Arcawiki",
    "shell.connectedMessage": "Connection to the game server established",
    "shell.connectedTitle": "Connection",
    "shell.countryCustomizedMessage": "Customization applied to {country} (-ducats)",
    "shell.countryCustomizedTitle": "Country updated",
    "shell.contentPanel": "Content",
    "shell.dashboard.activeProjects": "Active projects",
    "shell.dashboard.activeResearch": "Active research",
    "shell.dashboard.army": "Command posture",
    "shell.dashboard.armyIntro": "Use the map to read positions and open the army board for orders.",
    "shell.dashboard.availableConstruction": "Construction reserve",
    "shell.dashboard.construction": "Regional works",
    "shell.dashboard.constructionIntro": "Construction remains region-first: select land, then open the queue.",
    "shell.dashboard.constructionSpend": "Planned spend",
    "shell.dashboard.controlledRegions": "Controlled regions",
    "shell.dashboard.cultureReserve": "Culture reserve",
    "shell.dashboard.diplomacy": "Foreign office",
    "shell.dashboard.diplomacyIntro": "Read relations on the map and open negotiations from the selected country.",
    "shell.dashboard.ducatFlow": "Ducat flow",
    "shell.dashboard.goldReserve": "Gold reserve",
    "shell.dashboard.governance": "Country office",
    "shell.dashboard.governanceIntro": "Politics, research, decisions, and events share one state office.",
    "shell.dashboard.market": "Market pressure",
    "shell.dashboard.marketIntro": "Track goods, prices, reserves, and treasury movement before drilling down.",
    "shell.dashboard.notifications": "Notifications",
    "shell.dashboard.overview": "State ledger",
    "shell.dashboard.overviewIntro": "A compact first-turn view: money, pending decisions, and the next required checks.",
    "shell.dashboard.pendingDecisions": "Pending decisions",
    "shell.dashboard.population": "Society ledger",
    "shell.dashboard.populationIntro": "Population mode starts at country scale, then drills into selected regions.",
    "shell.dashboard.religionReserve": "Religion reserve",
    "shell.dashboard.scienceReserve": "Science reserve",
    "shell.dashboard.scienceSpend": "Science committed",
    "shell.dashboard.totalPopulation": "Total population",
    "shell.dashboard.treasury": "Treasury",
    "shell.endTurn": "End turn",
    "shell.entryCountryProfile": "Country profile",
    "shell.entryEnterGame": "Enter game",
    "shell.entryLoadedDescription": "You can enter the game now",
    "shell.entryLoadedTitle": "Data loaded",
    "shell.entryLoading": "loading",
    "shell.entryLoadingDescription": "Preparing the map, settings, and your country state",
    "shell.entryLoadingStatus": "Loading game data",
    "shell.entryReadyStatus": "ready",
    "shell.entryProvinceIndex": "Provinces",
    "shell.entryPublicUi": "UI settings",
    "shell.entryWorldState": "World state",
    "shell.forceResolve": "Force resolve",
    "shell.gameSettings": "Game settings",
    "shell.globalMarketTitle": "Global market",
    "shell.localStateMissing": "Local state is missing; running snapshot resync",
    "shell.loginMessage": "You entered {country}",
    "shell.loginTitle": "Login",
    "shell.logout": "Logout",
    "shell.logoutMessage": "Player session ended",
    "shell.logoutToast": "You left the country",
    "shell.logoutTitle": "Logout",
    "shell.mapLens.army": "Military formations and movement",
    "shell.mapLens.construction": "Infrastructure pressure and routes",
    "shell.mapLens.diplomacy": "Treaties and foreign reach",
    "shell.mapLens.governance": "State regions and administration",
    "shell.mapLens.market": "Market membership and capitals",
    "shell.mapLens.overview": "Political ownership",
    "shell.mapLens.population": "Population density and society",
    "shell.mapLens.title": "Map lens",
    "shell.metric.area": "{area} km2",
    "shell.metric.colonies": "Colonies",
    "shell.metric.population": "Population",
    "shell.metric.regions": "Regions",
    "shell.mode.army": "Army",
    "shell.mode.armyDescription": "Map command mode for formations, routes, and operational control.",
    "shell.mode.construction": "Construction",
    "shell.mode.constructionDescription": "Region-first building management with queues, costs, and local limits.",
    "shell.mode.diplomacy": "Diplomacy",
    "shell.mode.diplomacyDescription": "Country relation map with proposals, treaties, and foreign actions.",
    "shell.mode.governance": "Governance",
    "shell.mode.governanceDescription": "Country office for politics, technology, decisions, events, and modifiers.",
    "shell.mode.market": "Market",
    "shell.mode.marketDescription": "Goods dashboard for prices, shortages, surplus, and market pressure.",
    "shell.mode.overview": "Overview",
    "shell.mode.overviewDescription": "Country dashboard over the map: resources, issues, readiness, and priorities.",
    "shell.mode.population": "Population",
    "shell.mode.populationDescription": "Society dashboard for pops, professions, cultures, religions, and needs.",
    "shell.modeDock": "Map modes",
    "shell.notifications": "Notifications",
    "shell.orderColonizationTitle": "New colonization order",
    "shell.orderArmyMoveMessage": "Division {division} redeployed to {province}",
    "shell.orderSent": "Order sent",
    "shell.orderTitle": "New order",
    "shell.preview.activeResearchDetail": "Current technology tracks",
    "shell.preview.armyLedger": "Army board",
    "shell.preview.averageOrganization": "Average organization",
    "shell.preview.averageOrganizationDetail": "Across field divisions",
    "shell.preview.bills": "Bills",
    "shell.preview.billsDetail": "Parliament agenda",
    "shell.preview.constructionQueue": "Construction queue",
    "shell.preview.diplomacyLedger": "Diplomatic desk",
    "shell.preview.divisions": "Divisions",
    "shell.preview.formationQueue": "Formation queue",
    "shell.preview.formationQueueDetail": "Units being formed",
    "shell.preview.governanceLedger": "Office ledger",
    "shell.preview.marketLedger": "Market ledger",
    "shell.preview.noArmy": "No field divisions or formations yet.",
    "shell.preview.noConstruction": "No active construction projects for your controlled regions.",
    "shell.preview.noDiplomacy": "No visible diplomatic proposals involving your country.",
    "shell.preview.noGovernance": "No governance records are available yet.",
    "shell.preview.noMarket": "No market summary is available yet.",
    "shell.preview.noPopulation": "No controlled population is available yet.",
    "shell.preview.noStories": "No recent state stories yet.",
    "shell.preview.open": "Open",
    "shell.preview.outboundProposals": "Outbound proposals",
    "shell.preview.outboundProposalsDetail": "Sent negotiations still open",
    "shell.preview.pendingResponse": "Pending response",
    "shell.preview.pendingResponseDetail": "Treaties awaiting your answer",
    "shell.preview.populationLedger": "Society ledger",
    "shell.preview.populationTotal": "Population",
    "shell.preview.records": "Records",
    "shell.preview.recordsDetail": "Decision and event records",
    "shell.preview.relatedTreaties": "Related treaties",
    "shell.preview.relatedTreatiesDetail": "All visible proposals involving you",
    "shell.preview.storyFeed": "Story feed",
    "shell.preview.subsidies": "Subsidies",
    "shell.preview.topCulture": "Top culture",
    "shell.preview.topProfession": "Top profession",
    "shell.resource.colonization": "Colonization",
    "shell.resource.construction": "Construction",
    "shell.resource.culture": "Culture",
    "shell.resource.ducats": "Ducats",
    "shell.resource.gold": "Gold",
    "shell.resource.religion": "Religion",
    "shell.resource.science": "Science",
    "sideNav.army": "Army",
    "sideNav.budget": "Budget",
    "sideNav.buildings": "Buildings",
    "sideNav.decisions": "Decisions",
    "sideNav.diplomacy": "Diplomacy",
    "sideNav.events": "Events",
    "sideNav.globalMarket": "Global market",
    "sideNav.intel": "Intelligence",
    "sideNav.market": "Market",
    "sideNav.modifiers": "Modifiers",
    "sideNav.politics": "Politics",
    "sideNav.population": "Population",
    "sideNav.technology": "Technology",
    "sideNav.trade": "Trade",
    "topBar.adminForceResolve": "Admin: force resolve",
    "topBar.clientSettings": "Client settings",
    "topBar.colonizationLimit": "Colonization limit",
    "topBar.contentPanel": "Content panel",
    "topBar.controlledProvinces": "Controlled provinces",
    "topBar.countryDetails": "Country and holdings details",
    "topBar.currentTurn": "Current turn",
    "topBar.currentValue": "Current value",
    "topBar.expensePerTurn": "Expense per turn",
    "topBar.gameSettings": "Game settings",
    "topBar.growthPerTurn": "Growth per turn",
    "topBar.knowledgeBase": "Knowledge base",
    "topBar.logout": "Log out",
    "topBar.netGrowth": "Net growth",
    "topBar.netPerTurn": "Net per turn",
    "topBar.nextTurn": "Next turn #{turn}",
    "topBar.openCountryDetails": "Open country details",
    "topBar.openResourceDetails": "{resource}: open details",
    "topBar.populationAria": "Population: {population}, net growth {growth}",
    "topBar.populationDescription": "Total population, births, and deaths over the last turn",
    "topBar.resourceTip.colonization": "Colonization points gained each turn",
    "topBar.resourceTip.construction": "Construction points for production orders",
    "topBar.resourceTip.culture": "Culture points for developing traditions",
    "topBar.resourceTip.ducats": "Planning budget for the current turn",
    "topBar.resourceTip.gold": "State treasury for large projects",
    "topBar.resourceTip.religion": "Religion influences stability and missions",
    "topBar.resourceTip.science": "Science points accelerate research",
    "topBar.time.day": "d",
    "topBar.time.hour": "h",
    "topBar.time.minute": "m",
    "topBar.time.second": "s",
    "topBar.totalArea": "Total area",
    "textInput.emptyResets": "An empty value resets the field",
    "shell.readiness.empty": "No country readiness records are visible yet.",
    "shell.readiness.offline": "Offline",
    "shell.readiness.online": "Online",
    "shell.readiness.progress": "{ready}/{required} ready",
    "shell.readiness.status.blocked": "Blocked",
    "shell.readiness.status.ignored": "Ignored",
    "shell.readiness.status.ready": "Ready",
    "shell.readiness.status.waiting": "Waiting",
    "shell.readiness.title": "Country Readiness",
    "shell.rejectedOrders": "Rejected orders: {count}",
    "shell.rejectedOrdersMessage": "Rejected orders: {count}",
    "shell.registrationAlreadyReviewed": "Request has already been reviewed",
    "shell.registrationApproved": "Registration approved",
    "shell.registrationReviewPrompt": "Approve this country registration and allow it to enter the game?",
    "shell.registrationReviewTitle": "Country registration review",
    "shell.registrationReviewUnavailable": "Request data is unavailable.",
    "shell.registrationRejected": "Registration rejected",
    "shell.registrationReviewFailed": "Failed to process request",
    "shell.replayRequested": "Version desync detected; delta replay requested",
    "shell.replayUnavailable": "Replay unavailable; running snapshot resync",
    "shell.resolveAutoUnconfirmed": "Auto-resolve was not confirmed by the server",
    "shell.resolveDoneDescription": "Turn #{turn} processed successfully",
    "shell.resolveDoneTitle": "Turn processing complete",
    "shell.resolveDuration": "Total processing time",
    "shell.resolveForceDescription": "Forced turn resolve",
    "shell.resolveManualUnconfirmed": "Resolve was not confirmed by the server",
    "shell.resolveProcessingDescription": "Please wait while the server resolves orders",
    "shell.resolveProcessingTitle": "Processing turn",
    "shell.resolveReturn": "Return to game",
    "shell.resolveTimeoutAutoDescription": "TURN_RESOLVE_STARTED did not arrive in time. Actions remain available.",
    "shell.resolveTimeoutManualDescription": "TURN_RESOLVE_STARTED did not arrive in time.",
    "shell.resolveUnavailableDescription": "Actions are temporarily unavailable during processing",
    "shell.scenarioApplied": "Scenario applied",
    "shell.scenarioAppliedDescription": "Reloading map and world state",
    "shell.serverErrorTitle": "Error",
    "shell.eventAlreadyResolved": "Event already resolved",
    "shell.eventAutoResolved": "Event resolved automatically",
    "shell.eventAutoResolvedDescription": "Because the head of state did not choose an option, the government selected: {option}.",
    "shell.adminCommandSent": "Admin command sent",
    "shell.adminCommandTitle": "Admin command",
    "shell.adminOnly": "Administrators only",
    "shell.story.category.colonization": "Colonization",
    "shell.story.category.diplomacy": "Diplomacy",
    "shell.story.category.economy": "Economy",
    "shell.story.category.military": "Military",
    "shell.story.category.politics": "Politics",
    "shell.story.category.system": "System",
    "shell.story.priority.high": "High",
    "shell.story.priority.low": "Low",
    "shell.story.priority.medium": "Medium",
    "shell.turn": "Turn {turn}",
    "shell.turnCompletedTitle": "Turn #{turn} complete",
    "shell.turnResolved": "Turn resolved successfully",
    "shell.turnResolvedClean": "Resolve completed without rejected orders",
    "shell.turnStatus": "Readiness",
    "shell.unnamedCountry": "Unnamed power",
    "shell.worldResyncFailed": "Failed to synchronize world; reloading",
    "shell.worldResynced": "World state synchronized again",
    "shell.workspace": "Workspace",
    "turnStatus.blockedPermanent": "Blocked permanently",
    "turnStatus.blockedUntilTime": "Blocked until {time}",
    "turnStatus.blockedUntilTurn": "Blocked until turn {turn}",
    "turnStatus.lastLogin": "Last login: {value}",
    "turnStatus.loading": "Loading country readiness...",
    "turnStatus.noLoginData": "no data",
    "technology.cancelResearch": "Cancel",
    "technology.description": "Description",
    "technology.descriptionMissing": "Technology description is not set.",
    "technology.empty": "No technologies have been created yet",
    "technology.loadFailed": "Failed to load technologies",
    "technology.loading": "Loading technologies...",
    "technology.nodeCount": "{count} nodes",
    "technology.notAvailable": "Technology is not available yet",
    "technology.progress": "Progress",
    "technology.prerequisites": "Requires",
    "technology.researchAdded": "Research added",
    "technology.researchCanceled": "Research canceled",
    "technology.rootTechnology": "Root technology.",
    "technology.scienceCost": "{cost} science",
    "technology.selectPrompt": "Select a technology in the tree to inspect its description, requirements, and unlocks.",
    "technology.startResearch": "Research",
    "technology.status.available": "Available",
    "technology.status.locked": "Locked",
    "technology.status.notSelected": "Not selected",
    "technology.status.researched": "Researched",
    "technology.status.researching": "Researching",
    "technology.title": "Technology",
    "technology.unlockBuildings": "Buildings",
    "technology.unlockLaws": "Laws",
    "technology.unlocks": "Unlocks",
    "technology.unlocksEmpty": "No explicit unlocks.",
    "technology.updateFailed": "Failed to change research",
  },
  ru: {
    "adminPanel.broadcastFailed": "Не удалось отправить уведомление",
    "adminPanel.broadcastMissingFields": "Заполните заголовок и текст уведомления",
    "adminPanel.broadcastSent": "Уведомление отправлено всем игрокам",
    "adminPanel.category.countries": "Управление странами",
    "adminPanel.category.notifications": "Рассылка уведомлений",
    "adminPanel.category.population": "Управление населением",
    "adminPanel.category.provinces": "Провинции / Колонизация",
    "adminPanel.countryDeleted": "Страна удалена",
    "adminPanel.countryDeleteFailed": "Не удалось удалить страну",
    "adminPanel.countryDeleteSelfFailed": "Нельзя удалить страну, под которой вы вошли",
    "adminPanel.countryHasNoRegions": "У выбранной страны нет регионов",
    "adminPanel.countryUpdated": "Страна обновлена",
    "adminPanel.countryUpdateFailed": "Не удалось обновить страну",
    "adminPanel.deleteCountryConfirm": "Удалить страну {country}?",
    "adminPanel.ignoreUpdated": "Исключение из пропуска хода обновлено",
    "adminPanel.ignoreUpdateFailed": "Не удалось обновить исключение",
    "adminPanel.populationCleared": "Население очищено: {count} регионов",
    "adminPanel.populationClearFailed": "Не удалось очистить население",
    "adminPanel.populationGenerated": "Население сгенерировано: {count} регионов",
    "adminPanel.populationGenerateFailed": "Не удалось сгенерировать население",
    "adminPanel.populationJsonInvalid": "Проверьте JSON pop-групп",
    "adminPanel.punishmentStatus.ignoredUntilTurn": "Не учитывать при пропуске хода до #{turn}",
    "adminPanel.punishmentStatus.none": "Ограничений нет",
    "adminPanel.punishmentStatus.permanent": "Перманентная блокировка входа",
    "adminPanel.punishmentStatus.untilTime": "Блокировка до {time}",
    "adminPanel.punishmentStatus.untilTurn": "Блокировка до хода #{turn}",
    "adminPanel.punishmentUpdated": "Наказание обновлено",
    "adminPanel.punishmentUpdateFailed": "Не удалось применить наказание",
    "adminPanel.regionCostReset": "Цена региона сброшена к авто",
    "adminPanel.regionCostResetFailed": "Не удалось сбросить цену к авто",
    "adminPanel.regionPopulationUpdated": "Население региона обновлено",
    "adminPanel.regionPopulationUpdateFailed": "Не удалось обновить население региона",
    "adminPanel.regionUpdated": "Регион обновлен",
    "adminPanel.regionUpdateFailed": "Не удалось обновить регион",
    "adminPanel.selectCountry": "Выберите страну",
    "adminPanel.selectRegion": "Выберите регион",
    "common.cancel": "Отмена",
    "common.close": "Закрыть",
    "common.confirm": "Подтвердить",
    "common.pending": "Применяем...",
    "common.refresh": "Обновить",
    "common.save": "Сохранить",
    "common.saving": "Сохранение...",
    "commandPalette.action.budget": "Открыть бюджет",
    "commandPalette.action.province": "К выбору провинции",
    "commandPalette.action.resolve": "Запросить резолв",
    "commandPalette.action.routes": "К торговым маршрутам",
    "commandPalette.action.politics": "Открыть политику",
    "commandPalette.actions": "Действия",
    "commandPalette.empty": "Ничего не найдено",
    "commandPalette.placeholder": "Команды и переходы...",
    "customSelect.noOptions": "Нет вариантов",
    "customSelect.placeholder": "Выберите значение",
    "countryEvents.choiceRequired": "Событие требует выбора",
    "countryEvents.defaultEvent": "Событие",
    "countryEvents.effectFallback": "Эффект",
    "countryEvents.empty": "Нет событий",
    "countryEvents.emptyDescription": "Сейчас у страны нет ожидающих событий.",
    "countryEvents.historyEmpty": "История пуста",
    "countryEvents.historyEmptyDescription": "Страна ещё не выбирала варианты событий.",
    "countryEvents.historyMeta": "{option} · ход {turn}",
    "countryEvents.important": "Важное",
    "countryEvents.importantPending": "{count} важных событий ждут выбора",
    "countryEvents.loadFailed": "Не удалось загрузить события",
    "countryEvents.loading": "Загрузка событий",
    "countryEvents.loadingDescription": "Проверяем ожидающие события.",
    "countryEvents.notificationLoadingDescription": "Открываем событие из уведомления.",
    "countryEvents.optionFailed": "Не удалось выбрать вариант",
    "countryEvents.processed": "Событие обработано",
    "countryEvents.storySubtitle": "Событие страны · ход {turn}",
    "countryEvents.title": "События страны",
    "customization.afterPurchase": "После покупки",
    "customization.applied": "Изменения применены (-{ducats} дукатов)",
    "customization.applyFailed": "Не удалось применить изменения страны",
    "customization.availableDucats": "Доступно: {ducats} дукатов",
    "customization.buyAndApply": "Купить и применить",
    "customization.changeColor": "Смена цвета",
    "customization.changeCrest": "Смена герба",
    "customization.changeFlag": "Смена флага",
    "customization.costTitle": "Стоимость изменений",
    "customization.crestPreviewAlt": "Предпросмотр герба",
    "customization.currentCrestAlt": "Текущий герб",
    "customization.currentFlagAlt": "Текущий флаг",
    "customization.flagPreviewAlt": "Предпросмотр флага",
    "customization.insufficientDucats": "Недостаточно дукатов: нужно {need}, доступно {available}",
    "customization.loadingPrices": "Загрузка цен...",
    "customization.loadPricesFailed": "Не удалось загрузить цены кастомизации",
    "customization.noChanges": "Нет изменений для сохранения",
    "customization.notEnoughDucats": "Недостаточно дукатов",
    "customization.notSelected": "Не выбран",
    "customization.rename": "Переименование",
    "customization.saving": "Сохраняем...",
    "customization.total": "Итого",
    "eventLog.category": "Категория: {category}",
    "eventLog.categories": "Категории",
    "eventLog.clear": "Очистить журнал",
    "eventLog.collapse": "Свернуть журнал",
    "eventLog.countTooltip": "Количество записей в журнале",
    "eventLog.countryFilter": "Фильтр по стране",
    "eventLog.countryScope": "Принадлежность",
    "eventLog.countryTooltip": "Страна: {country}",
    "eventLog.duplicateCount": "Сколько одинаковых событий объединено",
    "eventLog.empty": "Нет событий",
    "eventLog.expand": "Развернуть журнал событий",
    "eventLog.expandMessage": "Показать полностью",
    "eventLog.groupDuplicatesOff": "Группировка: выкл",
    "eventLog.groupDuplicatesOn": "Группировка: вкл",
    "eventLog.groupDuplicatesTooltip": "Объединять одинаковые события в одну запись с счетчиком xN",
    "eventLog.hideMessage": "Скрыть полное сообщение",
    "eventLog.priority": "Приоритет",
    "eventLog.priorityHigh": "Высокий приоритет",
    "eventLog.priorityLow": "Низкий приоритет",
    "eventLog.priorityMedium": "Средний приоритет",
    "eventLog.priorityTooltip": "Показать события с приоритетом: {priority}",
    "eventLog.privateTooltip": "Приватное событие (видно только вашей стране)",
    "eventLog.scope.all": "Все",
    "eventLog.scope.foreign": "Чужие",
    "eventLog.scope.own": "Наши",
    "eventLog.scopeTooltip": "Показать: {scope} события",
    "eventLog.sortPriority": "Сортировка: по важности",
    "eventLog.sortTime": "Сортировка: по времени",
    "eventLog.systemAlwaysVisible": "Системные события всегда видимы",
    "eventLog.title": "Журнал событий",
    "eventLog.trimOld": "Скрыть старые",
    "eventLog.turn": "Ход #{turn}",
    "eventLog.turnTooltip": "Событие зафиксировано на ходу #{turn}",
    "gameSettings.applyScenarioConfirm": "Начать новую игру по сценарию \"{scenario}\"?\n\nТекущее состояние мира, очереди и прогресс будут сброшены.",
    "gameSettings.autoCostsRecalculated": "Пересчитаны авто-цены: {count}",
    "gameSettings.autoCostsRecalculateFailed": "Не удалось пересчитать авто-цены",
    "gameSettings.backgroundCleared": "Фон интерфейса удален",
    "gameSettings.backgroundClearFailed": "Не удалось удалить фон интерфейса",
    "gameSettings.backgroundCurrent": "Текущий фон",
    "gameSettings.backgroundDelete": "Удалить фон",
    "gameSettings.backgroundEmpty": "Фон не установлен",
    "gameSettings.backgroundSaved": "Фон интерфейса обновлен",
    "gameSettings.backgroundSaveFailed": "Не удалось обновить фон интерфейса",
    "gameSettings.backgroundSelectFirst": "Сначала выберите изображение",
    "gameSettings.backgroundTitle": "Фоновое изображение интерфейса (макс. 4096x4096)",
    "gameSettings.backgroundTooLarge": "Фоновое изображение должно быть максимум 4096x4096",
    "gameSettings.backgroundUpload": "Загрузить фон",
    "gameSettings.category.background": "Фон интерфейса",
    "gameSettings.category.colonization": "Колонизация",
    "gameSettings.category.customization": "Кастомизация",
    "gameSettings.category.economy": "Экономика",
    "gameSettings.category.eventLog": "Журнал событий",
    "gameSettings.category.registration": "Регистрация",
    "gameSettings.category.resourceIcons": "Иконки очков",
    "gameSettings.category.scenarios": "Сценарии",
    "gameSettings.category.turnTimer": "Таймер хода",
    "gameSettings.chooseFile": "Выбрать файл",
    "gameSettings.chooseImage": "Выбрать изображение",
    "gameSettings.colonization.costNote": "Базовая стоимость региона рассчитывается от площади: ставка за 1000 км2 x площадь / 1000. Ручная стоимость региона в админ-редакторе остается override.",
    "gameSettings.colonization.ducatsCost": "Цена (дукаты) за 1000 км2",
    "gameSettings.colonization.maxActive": "Макс. одновременных колонизаций",
    "gameSettings.colonization.pointsCost": "Цена (очки колонизации) за 1000 км2",
    "gameSettings.colonization.pointsPerTurn": "Прирост очков колонизации / ход",
    "gameSettings.colonization.settlersDescription": "Добавляет население только при первом захвате пустого региона",
    "gameSettings.colonization.settlersDisable": "Отключить стартовых поселенцев",
    "gameSettings.colonization.settlersEnable": "Включить стартовых поселенцев",
    "gameSettings.colonization.settlersEnabled": "Стартовые поселенцы",
    "gameSettings.colonization.settlersOnCapture": "Поселенцы при захвате пустого региона",
    "gameSettings.colonizationSaved": "Настройки колонизации сохранены",
    "gameSettings.colonizationSaveFailed": "Не удалось сохранить настройки колонизации",
    "gameSettings.colonizationTitle": "Лимиты колонизации",
    "gameSettings.customization.crest": "Смена герба",
    "gameSettings.customization.flag": "Смена флага",
    "gameSettings.customization.recolor": "Смена цвета",
    "gameSettings.customization.renameCountry": "Переименование страны",
    "gameSettings.customization.renameProvince": "Переименование провинции",
    "gameSettings.customizationSaved": "Цены кастомизации сохранены",
    "gameSettings.customizationSaveFailed": "Не удалось сохранить цены кастомизации",
    "gameSettings.customizationTitle": "Цены на изменение страны за дукаты",
    "gameSettings.economy.constructionPerTurn": "Очки строительства / ход",
    "gameSettings.economy.culturePerTurn": "Культура / ход",
    "gameSettings.economy.demolitionCost": "Снос постройки (% строительства)",
    "gameSettings.economy.ducatsPerTurn": "Дукаты / ход",
    "gameSettings.economy.durabilityDecay": "Потеря прочности / ход (неактивные)",
    "gameSettings.economy.durabilityRecovery": "Восстановление прочности / ход (активные)",
    "gameSettings.economy.explorationDepletion": "Рост шанса пусто за попытку (%)",
    "gameSettings.economy.explorationDuration": "Длительность разведки (ходы)",
    "gameSettings.economy.explorationEmptyChance": "Базовый шанс пустой разведки (%)",
    "gameSettings.economy.explorationRolls": "Роллов за разведку",
    "gameSettings.economy.goldPerTurn": "Золото / ход",
    "gameSettings.economy.marketSmoothing": "Сглаживание цены рынка (0..1)",
    "gameSettings.economy.pollutionEffect": "Эффект загрязнения / 1000",
    "gameSettings.economy.religionPerTurn": "Религия / ход",
    "gameSettings.economy.sciencePerTurn": "Наука / ход",
    "gameSettings.economySaved": "Настройки экономики сохранены",
    "gameSettings.economySaveFailed": "Не удалось сохранить настройки экономики",
    "gameSettings.economyTitle": "Базовый доход за каждый резолв хода",
    "gameSettings.eventLogRetention": "Хранить события за последние ходы",
    "gameSettings.eventLogSaved": "Настройки журнала событий сохранены",
    "gameSettings.eventLogSaveFailed": "Не удалось сохранить настройки журнала событий",
    "gameSettings.eventLogTitle": "Глобальные настройки журнала событий",
    "gameSettings.fileSelected": "Выбран файл: {file}",
    "gameSettings.loadFailed": "Не удалось загрузить настройки игры",
    "gameSettings.loading": "Загрузка настроек...",
    "gameSettings.map.hideAntarctica": "Скрыть Антарктиду",
    "gameSettings.map.showAntarctica": "Показывать Антарктиду",
    "gameSettings.map.showAntarcticaAction": "Показать Антарктиду",
    "gameSettings.map.showAntarcticaDescription": "Скрывает провинции Антарктиды на карте для всех игроков",
    "gameSettings.no": "нет",
    "gameSettings.recalculateAutoCosts": "Пересчитать все авто-цены",
    "gameSettings.registrationApprovalDisable": "Выключить подтверждение регистрации",
    "gameSettings.registrationApprovalEnable": "Включить подтверждение регистрации",
    "gameSettings.registrationRequireApproval": "Требовать подтверждение администратора",
    "gameSettings.registrationRequireApprovalDescription": "Новые страны регистрируются, но не могут войти до одобрения админом",
    "gameSettings.registrationSaved": "Настройки регистрации сохранены",
    "gameSettings.registrationSaveFailed": "Не удалось сохранить настройки регистрации",
    "gameSettings.registrationTitle": "Регистрация новых стран",
    "gameSettings.resource.population": "Население",
    "gameSettings.resourceIconEmpty": "Нет иконки",
    "gameSettings.resourceIconSelectFirst": "Сначала выберите хотя бы одну иконку",
    "gameSettings.resourceIconsSaved": "Иконки очков обновлены",
    "gameSettings.resourceIconsSaveFailed": "Не удалось обновить иконки очков",
    "gameSettings.resourceIconsTitle": "Иконки очков в верхней панели (макс. 64x64)",
    "gameSettings.resourceIconsUpload": "Загрузить иконки",
    "gameSettings.resourceIconTooLarge": "Иконка должна быть максимум 64x64",
    "gameSettings.resourceIconTooLargeFor": "Иконка \"{resource}\" должна быть максимум 64x64",
    "gameSettings.scenarioActive": "Активен",
    "gameSettings.scenarioApplied": "Сценарий применен",
    "gameSettings.scenarioAppliedDescription": "Перезагружаем карту и состояние мира",
    "gameSettings.scenarioApplyFailed": "Не удалось применить сценарий",
    "gameSettings.scenarioFiles": "Content: {content} файлов · Setup: {setup} файлов",
    "gameSettings.scenarioMap": "Карта: {map}",
    "gameSettings.scenarioMvt": "MVT {value}",
    "gameSettings.scenarioRaster": "Raster {value}",
    "gameSettings.scenariosDescription": "Сценарий переключает карту, content library и стартовые setup-файлы. Применение сценария создает новую игру и сбрасывает текущее состояние мира.",
    "gameSettings.scenarioSelected": "Выбран",
    "gameSettings.scenariosEmpty": "Сценарии не найдены. Добавь папки в apps/server/data/scenarios.",
    "gameSettings.scenariosLoadFailed": "Не удалось загрузить сценарии",
    "gameSettings.scenariosLoading": "Загрузка сценариев...",
    "gameSettings.scenarioStart": "Начать",
    "gameSettings.scenarioStarting": "Запуск...",
    "gameSettings.scenarioStartTurn": "Ход старта: {turn}",
    "gameSettings.scenariosTitle": "Сценарии новой игры",
    "gameSettings.title": "Настройки игры",
    "gameSettings.turnTimerDisable": "Выключить таймер хода",
    "gameSettings.turnTimerEnable": "Включить таймер хода",
    "gameSettings.turnTimerEnabled": "Включить авто-переход хода",
    "gameSettings.turnTimerEnabledDescription": "Сервер завершит ход по таймеру даже если не все страны нажали следующий ход",
    "gameSettings.turnTimerPauseDisable": "Выключить паузу таймера без игроков",
    "gameSettings.turnTimerPauseEnable": "Включить паузу таймера без игроков",
    "gameSettings.turnTimerPauseOffline": "Пауза таймера без игроков онлайн",
    "gameSettings.turnTimerPauseOfflineDescription": "Если включено, авто-таймер не тикает, пока онлайн 0 игроков.",
    "gameSettings.turnTimerRange": "Диапазон: 10-2 592 000 секунд (до 30 дней). Таймер сбрасывается после каждого резолва хода.",
    "gameSettings.turnTimerSaved": "Таймер хода сохранен",
    "gameSettings.turnTimerSaveFailed": "Не удалось сохранить таймер хода",
    "gameSettings.turnTimerSeconds": "Секунд на ход",
    "gameSettings.turnTimerTitle": "Автоматический переход хода по таймеру",
    "gameSettings.yes": "есть",
    "auth.accountLockedPermanent": "Аккаунт заблокирован бессрочно",
    "auth.accountLockedTime": "Аккаунт заблокирован до {time}",
    "auth.accountLockedTurn": "Аккаунт заблокирован до хода #{turn}",
    "auth.chooseCountry": "Выберите страну",
    "auth.clientVersion": "client v0.1.0",
    "auth.country": "Страна",
    "auth.countryColor": "Цвет страны",
    "auth.countryCreated": "Страна создана, теперь войдите",
    "auth.countryName": "Название страны",
    "auth.createCountry": "Создать страну",
    "auth.creating": "Создание...",
    "auth.crest": "Герб",
    "auth.crestHint": "PNG/JPG/WEBP до 4MB, максимум 128x192, соотношение 2:3",
    "auth.crestInvalid": "Герб: максимум 128x192, соотношение 2:3",
    "auth.crestPreview": "Предпросмотр герба",
    "auth.enterGame": "Войти",
    "auth.enterPassword": "Введите пароль",
    "auth.fileTooLarge": "Файл слишком большой (до 4MB)",
    "auth.flag": "Флаг",
    "auth.flagHint": "PNG/JPG/WEBP до 4MB, максимум 192x128, соотношение 3:2",
    "auth.flagInvalid": "Флаг: максимум 192x128, соотношение 3:2",
    "auth.flagPreview": "Предпросмотр флага",
    "auth.imageFormatInvalid": "Проверьте формат: флаг 192x128 (3:2), герб 128x192 (2:3)",
    "auth.invalidHex": "Введите валидный HEX-цвет",
    "auth.invalidPassword": "Неверный пароль",
    "auth.knowledge": "Хранилище знаний",
    "auth.loadingGame": "Загрузка игры...",
    "auth.lockReason": "Причина: {reason}",
    "auth.login": "Вход",
    "auth.loginPending": "Вход...",
    "auth.loginSuccess": "Успешный вход",
    "auth.min2": "Минимум 2 символа",
    "auth.min8": "Минимум 8 символов",
    "auth.noFileSelected": "Не выбран",
    "auth.onlyImages": "Разрешены только изображения",
    "auth.password": "Пароль",
    "auth.passwordComplexityAria": "Проверка сложности пароля",
    "auth.passwordComplexityLoginNeed": "Добавьте буквы и цифры для сложности",
    "auth.passwordComplexityNeed": "Добавьте заглавную букву, цифру и спецсимвол",
    "auth.passwordComplexityOk": "Сложность пароля подходит",
    "auth.passwordLengthAria": "Проверка длины пароля",
    "auth.passwordLengthNeed": "Нужно минимум 8 символов",
    "auth.passwordLengthOk": "Длина пароля подходит",
    "auth.passwordMismatch": "Пароли не совпадают",
    "auth.presetColor": "Выбрать {color}",
    "auth.register": "Регистрация",
    "auth.registrationError": "Ошибка регистрации",
    "auth.registrationPendingApproval": "Регистрация ожидает подтверждения администратора",
    "auth.registrationPendingDescription": "Вы сможете войти в игру после одобрения заявки.",
    "auth.registrationSent": "Заявка на регистрацию отправлена",
    "auth.registrationSentMessage": "Страна {country} отправлена на подтверждение администраторам.",
    "auth.rememberMe": "Запомнить меня",
    "auth.repeatPassword": "Повтор пароля",
    "auth.selectCountry": "Выберите страну",
    "auth.selectImage": "Выбрать изображение",
    "auth.serverStatus.maintenance": "Технические работы",
    "auth.serverStatus.offline": "Оффлайн",
    "auth.serverStatus.online": "Онлайн",
    "auth.serverUnavailable": "Сервер недоступен",
    "auth.waitButton": "Буду ждать",
    "clientSettings.description": "Эти параметры не влияют на серверную игру и применяются только в вашем браузере.",
    "clientSettings.descriptionTitle": "Описание",
    "clientSettings.interface": "Интерфейс",
    "clientSettings.language": "Язык",
    "clientSettings.languageDescription": "Управляет переведенным клиентским UI. Старые экраны мигрируются постепенно.",
    "clientSettings.localNote": "Настройки сохраняются локально отдельно для каждой страны.",
    "clientSettings.mapControls": "Панель управления картой",
    "clientSettings.mapControlsDescription": "Кнопки зума, сброса и блокировки карты в правом нижнем углу.",
    "clientSettings.save": "Сохранить",
    "clientSettings.sortNotifications": "Сортировка уведомлений",
    "clientSettings.sortNotificationsDescription": "При открытии непросмотренные уведомления переставляются влево/в конец ряда.",
    "clientSettings.title": "Настройки клиента",
    "clientSettings.uiLanguage": "Язык интерфейса",
    "civilopedia.admin.addCategory": "Добавить",
    "civilopedia.admin.articleEditor": "Редактор статьи (Хранилище знаний)",
    "civilopedia.admin.articleImage": "Изображение статьи",
    "civilopedia.admin.articleImageHint": "Обложка статьи: максимум 1024x1024",
    "civilopedia.admin.category": "Категория",
    "civilopedia.admin.categoryExistsDescription": "Сначала перенесите или удалите статьи из этой категории",
    "civilopedia.admin.categoryExistsTitle": "Нельзя удалить категорию",
    "civilopedia.admin.categoryInputPlaceholder": "Новая категория",
    "civilopedia.admin.categoryManualPlaceholder": "Или введите вручную",
    "civilopedia.admin.categoryTitle": "Категории статей",
    "civilopedia.admin.copiedToken": "Токен скопирован",
    "civilopedia.admin.defaultArticleTitle": "Новая статья",
    "civilopedia.admin.defaultSectionTitle": "Содержание",
    "civilopedia.admin.deleteCategory": "Удалить категорию",
    "civilopedia.admin.description": "Краткое описание",
    "civilopedia.admin.emptyEditor": "Выберите статью для редактирования",
    "civilopedia.admin.inlineHint": "Используйте в тексте: [img:URL|64]",
    "civilopedia.admin.inlineImage": "Inline-изображения 64x64 в тексте",
    "civilopedia.admin.inlineImageDescription": "Токен показан ниже. Вставьте его в текст абзаца.",
    "civilopedia.admin.inlineImageLimit": "Лимит загрузки: максимум 64x64",
    "civilopedia.admin.inlineUpload": "Загрузить 64x64",
    "civilopedia.admin.keywords": "Теги (через запятую)",
    "civilopedia.admin.noImage": "Нет изображения",
    "civilopedia.admin.provinceArticleMissing": "Статья о провинции не найдена",
    "civilopedia.admin.provinceCategory": "Провинции",
    "civilopedia.admin.provinceDefaultBody": "Заполните описание, стратегическую ценность, особенности колонизации и исторические заметки.",
    "civilopedia.admin.provinceDefaultSummary": "Справочная статья по провинции {province}.",
    "civilopedia.admin.provinceDefaultTitle": "Провинция: {province}",
    "civilopedia.admin.provinceIdLine": "ID провинции: {provinceId}",
    "civilopedia.admin.relatedCsv": "Связанные статьи (ID через запятую)",
    "civilopedia.admin.removeCategoryBlocked": "Нельзя удалить категорию",
    "civilopedia.admin.removeCategoryBlockedDescription": "Сначала перенесите или удалите статьи из этой категории",
    "civilopedia.admin.saveArticle": "Сохранить статью",
    "civilopedia.admin.saved": "Хранилище знаний сохранено",
    "civilopedia.admin.saveFailed": "Не удалось сохранить Хранилище знаний",
    "civilopedia.admin.sectionFormatHint": "Формат секций: массив объектов вида { title, paragraphs: [..] }.",
    "civilopedia.admin.sectionsJson": "Секции (JSON)",
    "civilopedia.admin.title": "Заголовок",
    "civilopedia.admin.untitled": "Без названия",
    "civilopedia.admin.upload": "Загрузить",
    "civilopedia.admin.uploadedImage": "Изображение загружено",
    "civilopedia.admin.uploadImageFailed": "Не удалось загрузить изображение",
    "civilopedia.admin.uploadedInlineImage": "Inline-изображение загружено",
    "civilopedia.admin.uploadInlineImageFailed": "Не удалось загрузить inline-изображение",
    "civilopedia.admin.uploadInlineImageHint": "Цветные слова: [color:#22c55e]текст[/color]",
    "civilopedia.admin.urlPlaceholder": "URL изображения",
    "civilopedia.category.basics": "Основы",
    "civilopedia.category.colonization": "Колонизация",
    "civilopedia.category.economy": "Ресурсы и экономика",
    "civilopedia.category.journal": "Журнал событий",
    "civilopedia.category.map": "Карта",
    "civilopedia.category.other": "Другое",
    "civilopedia.category.turns": "Ходы и таймер",
    "civilopedia.description": "Справочник по механикам и интерфейсу игры",
    "civilopedia.edit": "Редактировать",
    "civilopedia.editMode": "Режим редактирования",
    "civilopedia.emptySelection": "Выберите статью слева",
    "civilopedia.loading": "Загрузка...",
    "civilopedia.loadFailed": "Не удалось загрузить Хранилище знаний",
    "civilopedia.newArticle": "Новая статья",
    "civilopedia.noResults": "Ничего не найдено",
    "civilopedia.related": "Связанные статьи",
    "civilopedia.searchPlaceholder": "Поиск по статьям...",
    "civilopedia.title": "Хранилище знаний",
    "decisions.available": "Доступные",
    "decisions.category.colonization": "Колонизация",
    "decisions.category.culture": "Культура",
    "decisions.category.diplomacy": "Дипломатия",
    "decisions.category.economy": "Экономика",
    "decisions.category.military": "Армия",
    "decisions.category.politics": "Политика",
    "decisions.category.religion": "Религия",
    "decisions.category.technology": "Технологии",
    "decisions.cost": "Стоимость",
    "decisions.effectFallback": "Эффект",
    "decisions.effects": "Эффекты",
    "decisions.emptyAvailable": "Сейчас нет доступных решений.",
    "decisions.emptyLocked": "Недоступных решений нет.",
    "decisions.emptyTitle": "Нет решений",
    "decisions.history": "История",
    "decisions.historyEmpty": "История пуста",
    "decisions.historyEmptyDescription": "Страна ещё не принимала решений.",
    "decisions.loadFailed": "Не удалось загрузить решения",
    "decisions.loading": "Загрузка решений",
    "decisions.loadingDescription": "Проверяем условия для страны.",
    "decisions.locked": "Недоступные",
    "decisions.notAvailable": "Решение недоступно",
    "decisions.none": "Нет",
    "decisions.open": "Открыть",
    "decisions.resource.colonization": "Колонизация",
    "decisions.resource.construction": "Строительство",
    "decisions.resource.culture": "Культура",
    "decisions.resource.ducats": "Дукаты",
    "decisions.resource.gold": "Золото",
    "decisions.resource.religion": "Религия",
    "decisions.resource.science": "Наука",
    "decisions.storySubtitle": "Решение страны · {category}",
    "decisions.take": "Принять решение",
    "decisions.taken": "Решение принято",
    "decisions.takeFailed": "Не удалось принять решение",
    "decisions.title": "Решения страны",
    "decisions.turn": "Ход {turn}",
    "elections.distribution": "Распределение мест",
    "elections.distributionDescription": "Полукруг парламента по партиям",
    "elections.empty": "Нет данных о результатах выборов",
    "elections.government": "Правительство",
    "elections.noPartySeats": "Партии не получили мест",
    "elections.parties": "Партии",
    "elections.parliamentDescription": "Итоги парламентского голосования",
    "elections.seatShare": "Места: {value}",
    "elections.seats": "мест",
    "elections.subtitle": "Ход #{turn} · парламент на {seats} мест",
    "elections.title": "Результаты выборов",
    "elections.tooltipVotes": "Голоса: {value}",
    "elections.voteShare": "Голоса: {value}",
    "army.air": "Авиакрылья",
    "army.attack": "Атака",
    "army.baseProvince": "Провинция базирования",
    "army.battleSlots": "Боевые слоты",
    "army.branchTemplates": "Шаблоны: {branch}",
    "army.cancel": "Отменить",
    "army.composition": "Состав",
    "army.createFormation": "Сформировать",
    "army.defaultAir": "Новое авиакрыло",
    "army.defaultLand": "Новая дивизия",
    "army.defaultNaval": "Новый флот",
    "army.delete": "Удалить",
    "army.defense": "Защита",
    "army.description": "Шаблоны, формирование и базирование дивизий, флотов и авиакрыльев",
    "army.disbandDivision": "Расформировать дивизию",
    "army.emptyQueue": "Очередь пуста",
    "army.emptyQueueDescription": "Новые части появляются здесь после команды сформировать.",
    "army.form": "Формирование",
    "army.formation": "Формирование",
    "army.formationQueue": "Очередь формирования",
    "army.formationSpeed": "Скорость формирования: {speed}",
    "army.icon64": "Логотип 64x64",
    "army.iconInvalid64": "Логотип должен быть строго 64x64.",
    "army.iconUploadFailed": "Не удалось загрузить логотип.",
    "army.land": "Дивизии",
    "army.location": "Местоположение",
    "army.loading": "Загрузка вооружённых сил",
    "army.loadingDescription": "Получаем шаблоны, части и очередь.",
    "army.march": "Марш",
    "army.manpowerShort": "{count} люд.",
    "army.moveActive": "Режим перемещения активен",
    "army.moveCancel": "Отменить перемещение",
    "army.movePickDestination": "Нажмите на провинцию на карте, чтобы выбрать пункт назначения",
    "army.naval": "Флоты",
    "army.newTemplate": "Новый",
    "army.noData": "Нет данных",
    "army.noDataDescription": "Откройте окно после подключения к серверу.",
    "army.noReadyUnits": "Нет готовых частей",
    "army.noReadyUnitsDescription": "Поставьте формирование в очередь.",
    "army.organizationShort": "Орг.",
    "army.queue": "Очередь ({count})",
    "army.readyUnits": "Готовые части: {branch}",
    "army.saveTemplate": "Сохранить шаблон",
    "army.strengthShort": "Сила",
    "army.support": "Поддержка",
    "army.supplyShort": "Снабж.",
    "army.totalBattalions": "{count} батальонов",
    "army.totalSoldiers": "{count} солдат",
    "army.templateDeleted": "Шаблон удалён",
    "army.templateName": "Название шаблона",
    "army.unknownBattalion": "Батальон {number}",
    "army.unknownTemplate": "Неизвестный шаблон",
    "army.title": "Вооружённые силы",
    "army.unitName": "Название части",
    "locale.english": "Английский",
    "locale.russian": "Русский",
    "map.controls.zoomIn": "Приблизить карту",
    "map.controls.zoomOut": "Отдалить карту",
    "map.controls.resetView": "Сбросить центр и масштаб",
    "map.controls.lockInteraction": "Заблокировать pan/zoom",
    "map.controls.unlockInteraction": "Разблокировать pan/zoom",
    "map.mode.regions.label": "Регионы",
    "map.mode.regions.shortLabel": "Регионы",
    "map.mode.regions.legendLabel": "Государственный регион",
    "map.mode.regions.legendDescription": "Провинции, сгруппированные по gameplay-региону",
    "map.mode.provinceColors.label": "Цвета провинций",
    "map.mode.provinceColors.shortLabel": "Провинции",
    "map.mode.provinceColors.legendLabel": "Провинция",
    "map.mode.provinceColors.legendDescription": "Сценарные цвета lightweight map-провинций",
    "modifiers.activeCount": "Действующие эффекты: {count}",
    "modifiers.column.effect": "Параметр",
    "modifiers.column.modifier": "Модификатор",
    "modifiers.column.mode": "Тип",
    "modifiers.column.scope": "Область",
    "modifiers.column.source": "Источник",
    "modifiers.column.target": "Цель",
    "modifiers.column.value": "Значение",
    "modifiers.description": "{country} · {count} эффектов",
    "modifiers.empty": "У страны пока нет действующих модификаторов",
    "modifiers.loadFailed": "Не удалось загрузить модификаторы",
    "modifiers.loading": "Загрузка модификаторов...",
    "modifiers.scope.building": "Здание",
    "modifiers.scope.country": "Страна",
    "modifiers.scope.market": "Рынок",
    "modifiers.scope.pop": "Население",
    "modifiers.scope.province": "Провинция",
    "modifiers.source.event": "Событие",
    "modifiers.source.law": "Закон",
    "modifiers.source.modifier": "Модификатор",
    "modifiers.source.technology": "Технология",
    "modifiers.stat.building_construction_cost": "Стоимость строительства",
    "modifiers.stat.building_input": "Расходы зданий",
    "modifiers.stat.building_output": "Выпуск зданий",
    "modifiers.stat.building_throughput": "Производительность зданий",
    "modifiers.stat.building_wage": "Зарплаты зданий",
    "modifiers.stat.colonization_gain": "Прирост колонизации",
    "modifiers.stat.construction_gain": "Прирост строительства",
    "modifiers.stat.culture_gain": "Прирост культуры",
    "modifiers.stat.ducats_gain": "Прирост дукатов",
    "modifiers.stat.gold_gain": "Прирост золота",
    "modifiers.stat.religion_gain": "Прирост религии",
    "modifiers.stat.science_gain": "Прирост науки",
    "modifiers.stat.technology_cost": "Стоимость технологий",
    "modifiers.target.all": "Все подходящие цели",
    "modifiers.target.building": "здание: {value}",
    "modifiers.target.category": "категория: {value}",
    "modifiers.target.good": "товар: {value}",
    "modifiers.target.profession": "профессия: {value}",
    "modifiers.title": "Модификаторы страны",
    "notifications.category.diplomacy": "Дипломатия",
    "notifications.category.economy": "Экономика",
    "notifications.category.politics": "Политика",
    "notifications.category.registration": "Регистрация",
    "notifications.category.system": "Система",
    "notifications.delete": "Удалить уведомление из истории",
    "notifications.electionResults": "Результаты выборов: сформирован парламент на {seats} мест",
    "notifications.emptyHistory": "История уведомлений пока пуста.",
    "notifications.fallback.countryEvent": "Новое событие",
    "notifications.fallback.diplomacy": "Дипломатический договор",
    "notifications.fallback.electionResults": "Результаты выборов",
    "notifications.fallback.generic": "Уведомление",
    "notifications.fallback.registration": "Заявка на регистрацию",
    "politics.aboutSelectedLaw": "О выбранном законе",
    "politics.activePowerLaws": "Активные законы-источники",
    "politics.billStarted": "Законопроект внесен в парламент",
    "politics.billStartFailed": "Не удалось внести законопроект",
    "politics.billStatusDebating": "Обсуждение",
    "politics.chartTooltip": "{name}: {seats} мест",
    "politics.currentBills": "Законопроекты на голосовании",
    "politics.currentLimits": "Текущие ограничения",
    "politics.defaultPower": "Используется базовое полномочие",
    "politics.description": "До следующего пересчета выборов: {turns} ходов.",
    "politics.discipline": "Дисц. {value}%",
    "politics.interestGroups": "Группы интересов",
    "politics.lawAction.enact": "Принять",
    "politics.lawAction.vote": "На голосование",
    "politics.lawAlreadyActive": "Этот закон уже действует",
    "politics.lawAlreadyInVote": "Уже на голосовании",
    "politics.laws": "Законы",
    "politics.lawStatus.active": "Действует",
    "politics.lawStatus.inactive": "Не принят",
    "politics.lawStatus.voting": "На голосовании",
    "politics.legend.abstain": "Серый: в основном воздержание",
    "politics.legend.oppose": "Красный: большинство партии против",
    "politics.legend.partyColors": "Обычный режим: цвета партий",
    "politics.legend.support": "Зеленый: большинство партии за",
    "politics.limit.laws": "Законы: {value}",
    "politics.limit.lawsDirect": "можно принимать напрямую",
    "politics.limit.lawsVote": "нужно голосование",
    "politics.limit.noRatification": "без ратификации",
    "politics.limit.noThreshold": "без отдельного порога",
    "politics.limit.ratificationRequired": "требуют политической ратификации",
    "politics.limit.transferThreshold": "от {value} требуют контроля",
    "politics.limit.transfers": "Крупные выплаты: {value}",
    "politics.limit.treaties": "Территориальные договоры: {value}",
    "politics.loadFailed": "Не удалось загрузить политику",
    "politics.loading": "Загрузка...",
    "politics.loyalists": "Лоял. {value}",
    "politics.noCurrentBills": "Сейчас парламент не рассматривает законы.",
    "politics.noDescription": "Описание не задано.",
    "politics.noGroup": "Без группы",
    "politics.noInterestGroups": "Создайте группы интересов в панели контента и настройте веса профессий.",
    "politics.noLawGroups": "Создайте группы законов и законы в панели контента.",
    "politics.none": "нет",
    "politics.parliament": "Парламент",
    "politics.parliamentPowers": "Полномочия парламента",
    "politics.party.government": "Правительство",
    "politics.party.opposition": "Оппозиция",
    "politics.partyLabel": "Партия: {party}",
    "politics.power.budget.approveBudget": "Утверждает бюджет",
    "politics.power.budget.approveTaxes": "Утверждает налоги",
    "politics.power.budget.controlBudget": "Контролирует бюджет",
    "politics.power.diplomacy.ratifyAll": "Ратифицирует все договоры",
    "politics.power.diplomacy.ratifyMajorTreaties": "Ратифицирует крупные договоры",
    "politics.power.diplomacy.ratifyTerritory": "Ратифицирует территории",
    "politics.power.government.appointGovernment": "Назначает правительство",
    "politics.power.government.confidenceVote": "Вотум доверия",
    "politics.power.laws.advisory": "Совещательный голос",
    "politics.power.laws.approve": "Утверждает законы",
    "politics.power.laws.initiate": "Инициирует и утверждает",
    "politics.power.none": "Не участвует",
    "politics.power.war.approve": "Утверждает войну",
    "politics.power.war.declare": "Может объявлять войну",
    "politics.powerDescription.budgetDirect": "Бюджетные решения остаются за правителем.",
    "politics.powerDescription.budgetVote": "Часть бюджетных решений должна получать политическое одобрение.",
    "politics.powerDescription.diplomacyDirect": "Договоры подписываются без ратификации.",
    "politics.powerDescription.diplomacyVote": "Важные договоры могут требовать ратификации парламента.",
    "politics.powerDescription.governmentDirect": "Состав правительства не зависит от парламента.",
    "politics.powerDescription.governmentVote": "Парламент влияет на устойчивость или назначение правительства.",
    "politics.powerDescription.lawsDirect": "Законы можно принимать напрямую. Парламент не блокирует решение.",
    "politics.powerDescription.lawsVote": "Новые законы проходят через парламентское голосование.",
    "politics.powerDescription.warDirect": "Военные решения принимает правитель.",
    "politics.powerDescription.warVote": "Военные решения зависят от парламентского мандата.",
    "politics.powerDomain.budget": "Бюджет",
    "politics.powerDomain.diplomacy": "Дипломатия",
    "politics.powerDomain.government": "Правительство",
    "politics.powerDomain.laws": "Законы",
    "politics.powerDomain.war": "Война",
    "politics.preference.against": "против {value}",
    "politics.preference.for": "за {value}",
    "politics.preference.neutral": "нейтральна",
    "politics.preference.opposes": "Против",
    "politics.preference.supports": "Поддерживает",
    "politics.radicals": "Рад. {value}",
    "politics.rawPower": "Сила {value}",
    "politics.seatCount": "{seats} мест",
    "politics.seatDistribution": "Распределение мест по партиям",
    "politics.seats": "мест",
    "politics.selectLaw": "Выберите закон в списке.",
    "politics.selectedLaw": "Выбранный закон",
    "politics.selectedLawPreference": "К выбранному закону: {value}",
    "politics.selectLawForGroups": "Выберите закон, чтобы увидеть отношение групп.",
    "politics.tab.interestGroups": "Группы интересов",
    "politics.tab.laws": "Законы",
    "politics.tab.overview": "Обзор",
    "politics.tab.parties": "Партии",
    "politics.tab.powers": "Полномочия",
    "politics.title": "Политика: {country}",
    "politics.vote.abstainCompact": "Возд. {value}",
    "politics.vote.abstainShort": "Возд.",
    "politics.vote.abstainValue": "Возд.: {value}",
    "politics.vote.no": "Против",
    "politics.vote.noCompact": "Против {value}",
    "politics.vote.noValue": "Против: {value}",
    "politics.vote.yes": "За",
    "politics.vote.yesCompact": "За {value}",
    "politics.vote.yesValue": "За: {value}",
    "politics.voteForecast": "Прогноз голосования: {law}",
    "notifications.history": "История уведомлений",
    "notifications.new": "Новое",
    "notifications.openHistory": "Открыть историю уведомлений",
    "notifications.openHistoryDescription": "Открыть список прошлых уведомлений",
    "notifications.receivedTurn": "Ход получения: {turn}",
    "notifications.registrationRequest": "Заявка на регистрацию: {country}",
    "notifications.requiresDecision": "Требует решения",
    "notifications.total": "Всего: {count}",
    "notifications.viewed": "Просмотрено",
    "provincePanel.collapse": "Свернуть панель",
    "provinceTooltip.area": "Площадь: {area}",
    "provinceTooltip.colonization": "Колонизация",
    "provinceTooltip.owner": "Владелец: {owner}",
    "provincePanel.pin": "Закрепить панель",
    "provincePanel.unpin": "Открепить панель",
    "corridorBuild.title": "Строительство коридора",
    "corridorBuild.summary": "Точек маршрута: {points}. Провинций: {provinces}. Кликайте по своим провинциям, чтобы прокладывать путь.",
    "corridorBuild.undoPoint": "Убрать точку",
    "colonization.title": "Колонизация: {region}",
    "colonization.fallbackRegion": "Регион",
    "colonization.area": "Площадь: {area}",
    "colonization.showOwnColonies": "Показать данные по нашей колонии",
    "colonization.selectRegion": "Выберите регион",
    "colonization.cost": "Стоимость колонизации",
    "colonization.ducatsByArea": "Цена в дукатах (по площади):",
    "colonization.status": "Статус:",
    "colonization.statusOccupied": "занят ({country})",
    "colonization.statusDisabled": "запрещено",
    "colonization.statusAvailable": "доступно",
    "colonization.regionArea": "Площадь региона: {area}",
    "colonization.yourProgress": "Ваш прогресс: {progress} / {cost}",
    "colonization.limitTooltip": "Лимит активных колонизаций вашей страны: текущие активные колонии / максимум из настроек игры",
    "colonization.limit": "Лимит колонизаций",
    "colonization.raceLeader": "Лидер гонки",
    "colonization.noParticipants": "Нет участников",
    "colonization.disabledByAdmin": "Колонизация запрещена администратором",
    "colonization.participants": "Участники гонки",
    "colonization.noColonizers": "Пока никто не колонизирует этот регион",
    "colonization.openAdminEditor": "Открыть редактирование данных региона (только для админа)",
    "colonization.openAdminEditorAria": "Изменить регион (админ)",
    "colonization.cancelTooltipCan": "Остановить участие вашей страны в колонизации этого региона",
    "colonization.cancelTooltipCannot": "У вашей страны нет активной колонизации этого региона",
    "colonization.cancel": "Отменить колонизацию",
    "colonization.startTooltipCan": "Начать колонизацию: регион добавится в активные колонии страны",
    "colonization.startTooltipCannot": "Начать колонизацию сейчас нельзя (проверьте статус/лимит)",
    "colonization.start": "Начать колонизацию",
    "colonization.toastStarted": "Колонизация начата",
    "colonization.eventStartTitle": "Начало колонизации",
    "colonization.eventStartMessage": "Вы начали колонизацию региона {region}",
    "colonization.limitReached": "Достигнут лимит активных колонизаций",
    "colonization.eventLimitTitle": "Лимит колонизаций",
    "colonization.startFailed": "Не удалось начать колонизацию",
    "colonization.toastCanceled": "Колонизация отменена",
    "colonization.eventCancelTitle": "Отмена колонизации",
    "colonization.eventCancelMessage": "Вы отменили колонизацию региона {region}",
    "colonization.cancelFailed": "Не удалось отменить колонизацию",
    "diplomacy.transferRegion": "Передача региона",
    "diplomacy.transferRegionSummary": "{from} передаёт {to} регион {region}",
    "diplomacy.regionNotOwned": "Регион больше не принадлежит отправителю",
    "diplomacy.selectRegion": "Выберите регион",
    "diplomacy.accept": "Подписать",
    "diplomacy.activeTab": "Активные договоры",
    "diplomacy.addClauseFromColumn": "Добавьте пункт из {side} колонки.",
    "diplomacy.addTreatyClauses": "Добавьте статьи договора",
    "diplomacy.articleSuffix": "статьи",
    "diplomacy.categoryEconomy": "Экономика",
    "diplomacy.categoryInfrastructure": "Инфраструктура",
    "diplomacy.categoryOther": "Прочее",
    "diplomacy.categoryTerritory": "Территории",
    "diplomacy.clauseConstructionRights": "Строительство коридоров",
    "diplomacy.clauseOutsideParties": "В пункте указана страна вне договора",
    "diplomacy.clauseTextNote": "Текстовый пункт",
    "diplomacy.clauseTransferMoney": "Передача денег",
    "diplomacy.clauseTransit": "Транзит инфраструктуры",
    "diplomacy.constructionExpiration": "Что произойдет после окончания договора",
    "diplomacy.countrySelect": "Выберите страну",
    "diplomacy.createOrCheckOtherTab": "Создайте новый договор или проверьте другую вкладку.",
    "diplomacy.declineRenewal": "Не продлевать",
    "diplomacy.diplomaticAgreement": "Дипломатическое соглашение",
    "diplomacy.durationActive": "Действует {turns} ход.",
    "diplomacy.durationLabel": "Срок",
    "diplomacy.edit": "Изменить",
    "diplomacy.editingAgreement": "Редакция дипломатического соглашения",
    "diplomacy.emptyList": "Договоров здесь пока нет.",
    "diplomacy.expiredRenewal": "Срок закончился. Согласились: {count}/2",
    "diplomacy.fillClauses": "Заполните пункты договора",
    "diplomacy.insufficientFunds": "У одной из сторон не хватает денег",
    "diplomacy.incomingTab": "Входящие",
    "diplomacy.initiator": "Инициатор",
    "diplomacy.loadFailed": "Не удалось загрузить дипломатию",
    "diplomacy.negotiationMeta": "Переговоры: версия {revision}. Ход ответа: {responder}.",
    "diplomacy.newAgreement": "Новый договор",
    "diplomacy.noResponder": "нет",
    "diplomacy.ourArticles": "Ваши",
    "diplomacy.ourConditions": "Ваши условия",
    "diplomacy.outgoingTab": "Исходящие",
    "diplomacy.partyOurs": "Ваша сторона",
    "diplomacy.partyTheirs": "Вторая сторона",
    "diplomacy.paymentOnce": "разово",
    "diplomacy.paymentPerTurn": "за ход",
    "diplomacy.policyDisableWithoutTransit": "Отключить без транзита",
    "diplomacy.policyDisableWithoutTransitDescription": "Построенные участки остаются у строителя, но без транзита перестают работать.",
    "diplomacy.policyNationalize": "Национализировать",
    "diplomacy.policyNationalizeDescription": "После окончания договора коридор переходит владельцу территории.",
    "diplomacy.proposalName": "Название договора",
    "diplomacy.proposalNamePlaceholder": "По умолчанию: договор с номером",
    "diplomacy.reject": "Отклонить",
    "diplomacy.rejectFailed": "Не удалось отклонить договор",
    "diplomacy.rejected": "Договор отклонён",
    "diplomacy.responder": "Отвечает",
    "diplomacy.renew": "Продлить",
    "diplomacy.renewAccepted": "Договор продлён",
    "diplomacy.renewDeclined": "Продление отклонено",
    "diplomacy.renewDeclineFailed": "Не удалось отклонить продление",
    "diplomacy.renewFailed": "Не удалось продлить договор",
    "diplomacy.renewSent": "Согласие на продление отправлено",
    "diplomacy.selectOtherPartyFirst": "Сначала выберите вторую сторону договора",
    "diplomacy.selectCountryForTreaty": "Выберите страну для договора",
    "diplomacy.selectClauseFromSides": "Выберите пункт слева или справа, чтобы собрать предложение.",
    "diplomacy.selectTargetCountry": "Выберите вторую сторону",
    "diplomacy.sendFailed": "Не удалось отправить договор",
    "diplomacy.sendTooltip": "Отправляет договор второй стороне сразу, без сохранения черновика.",
    "diplomacy.submitAgreement": "Отправить договор",
    "diplomacy.submitRevision": "Вернуть с новыми условиями",
    "diplomacy.sent": "Договор отправлен",
    "diplomacy.signed": "Договор подписан",
    "diplomacy.signFailed": "Не удалось подписать договор",
    "diplomacy.storyActionFailed": "Не удалось обработать договор",
    "diplomacy.storyArticle": "Статья {number}",
    "diplomacy.storyArticles": "Статьи договора",
    "diplomacy.storyArticlesCount": "{count} пунктов",
    "diplomacy.storyDefaultTitle": "Дипломатический договор",
    "diplomacy.storyExpires": "до хода {turn}",
    "diplomacy.storyLoading": "Загрузка договора",
    "diplomacy.storyLoadingDescription": "Открываем условия из уведомления.",
    "diplomacy.storyNegotiationChain": "Цепочка переговоров",
    "diplomacy.storyPendingAccept": "Подписываем...",
    "diplomacy.storyPendingReject": "Отклоняем...",
    "diplomacy.storyRevision": "Версия {revision}: {from} -> {to}, ход {turn}",
    "diplomacy.storyRevisionHistory": "Версия",
    "diplomacy.storySubtitle": "Версия {revision} · ход {from}-{to}",
    "diplomacy.storyVersion": "Версия",
    "diplomacy.storyVersionRange": "версия {revision}",
    "diplomacy.storyYourTurnFailed": "Сейчас не ваша очередь отвечать",
    "diplomacy.status.accepted": "Подписан",
    "diplomacy.status.expired": "Истёк",
    "diplomacy.status.failed": "Не исполнен",
    "diplomacy.status.pending": "Ожидает подписи",
    "diplomacy.status.rejected": "Отклонён",
    "diplomacy.status.renewalPending": "Ожидает продления",
    "diplomacy.statusLine": "{status} · ход {from} - {to}",
    "diplomacy.title": "Дипломатия",
    "diplomacy.subtitle": "Конструктор договоров между живыми игроками",
    "diplomacy.summaryConstructionRights": "{from} разрешает {to} строительство коридоров: {modes}. После окончания: {policy}",
    "diplomacy.summaryMoney": "{from} передаёт {to} {amount} {resource} {cadence}",
    "diplomacy.summaryTransit": "{from} предоставляет {to} транзит: {modes}",
    "diplomacy.textNotePlaceholder": "Например: стороны обязуются не вмешиваться в колонизацию региона...",
    "diplomacy.theirArticles": "Их статьи",
    "diplomacy.theirConditions": "Условия второй стороны",
    "diplomacy.transportAir": "Воздух",
    "diplomacy.transportLand": "Сухопутный транспорт",
    "diplomacy.transportModes": "Типы транспорта",
    "diplomacy.transportPipeline": "Трубы",
    "diplomacy.transportPowerGrid": "Электросети",
    "diplomacy.transportSea": "Море",
    "diplomacy.secondParty": "Вторая сторона",
    "diplomacy.resourceDucats": "Дукаты",
    "diplomacy.resourceGold": "Золото",
    "diplomacy.leftSide": "левой",
    "diplomacy.rightSide": "правой",
    "diplomacy.updateSent": "Новая версия договора отправлена",
    "diplomacy.waitingOtherSide": "Ожидаем вторую сторону",
    "market.alerts": "Алерты",
    "market.critical": "Критические",
    "market.criticalGoodsTooltip": "Количество товаров с покрытием спроса ниже 50%.",
    "market.countryDescription": "Наш рынок ({country})",
    "market.countryTab": "Наш рынок",
    "market.emptyRows": "Нет данных по выбранным фильтрам.",
    "market.globalDescription": "Глобальный рынок",
    "market.globalTab": "Глобальный",
    "market.good": "Товар",
    "market.goodCatalogTooltip": "Товар из каталога контента.",
    "market.goodsInSelectionTooltip": "Количество товаров в текущей выборке таблицы.",
    "market.history": "История товара",
    "market.historyTooltip": "Исторические ряды по выбранному товару за последние ходы.",
    "market.inviteAccepted": "Приглашение принято",
    "market.inviteRejected": "Приглашение отклонено",
    "market.inviteFailed": "Не удалось обработать приглашение",
    "market.joined": "Вы вступили в рынок",
    "market.joinFailed": "Не удалось вступить в рынок",
    "market.joinRequestSent": "Запрос на вступление отправлен",
    "market.leaveFailed": "Не удалось выйти из рынка",
    "market.left": "Вы вышли из рынка",
    "market.management": "Управление",
    "market.membership": "Членство",
    "market.metric.coverage": "Покрытие",
    "market.metric.demand": "Спрос",
    "market.metric.offer": "Предложение",
    "market.metric.price": "Цена за ед.",
    "market.metric.productionFact": "Произв. факт",
    "market.metric.productionMax": "Произв. макс",
    "market.noSelectedGood": "Выберите товар в таблице.",
    "market.other": "Другие",
    "market.recentTurns": "{good} · последние {turns} ходов",
    "market.sanctions": "Санкции",
    "market.sortDeficit": "Сортировка: дефицит",
    "market.sortPrice": "Сортировка: цена",
    "market.sortVolatility": "Сортировка: волатильность",
    "market.title": "Рынок",
    "market.tradePartners": "Торговые партнеры",
    "market.turnLabel": "Ход {turn}",
    "market.pointLabel": "Точка {point}",
    "market.importCountriesTop": "Импорт из стран (топ 10)",
    "market.importMarketsTop": "Импорт из рынков (топ 10)",
    "market.exportCountriesTop": "Экспорт в страны (топ 10)",
    "market.exportMarketsTop": "Экспорт в рынки (топ 10)",
    "market.all": "Все",
    "market.accept": "Принять",
    "market.actionColumn": "Действие",
    "market.addGood": "Добавить товар",
    "market.addRuleEmpty": "Добавьте минимум одну строку товара.",
    "market.alertsDescription": "События дефицита, перегруза и неактивности зданий",
    "market.alertsTitle": "Алерты рынка",
    "market.allGoods": "Все товары",
    "market.apply": "Применить",
    "market.applyAll": "Применить всем",
    "market.applyPackage": "Применить пакет",
    "market.bulkDirectionTooltip": "Применить направление сразу ко всем строкам.",
    "market.bulkModeTooltip": "Применить режим сразу ко всем строкам.",
    "market.cancelInvite": "Отменить",
    "market.capColumn": "Лимит",
    "market.confirmationTitle": "Подтверждение",
    "market.countrySearch": "Поиск страны",
    "market.delete": "Удалить",
    "market.directionBoth": "Импорт+Экспорт",
    "market.directionColumn": "Направление",
    "market.directionExport": "Экспорт",
    "market.directionImport": "Импорт",
    "market.directionShortBoth": "Имп+Эксп",
    "market.disable": "Выключить",
    "market.durationPlaceholder": "Срок (ходов)",
    "market.durationTooltip": "Сколько ходов правило будет действовать.",
    "market.enable": "Включить",
    "market.filterNoResults": "По фильтру ничего не найдено.",
    "market.fromLabel": "От: {country}",
    "market.goodColumn": "Товар",
    "market.incomingInvites": "Входящие приглашения",
    "market.inviteCancelFailed": "Не удалось отменить приглашение",
    "market.inviteCanceled": "Приглашение отменено",
    "market.inviteSendFailed": "Не удалось отправить приглашение",
    "market.inviteSent": "Приглашение отправлено",
    "market.inviteStatusExpires": "Статус: {status} · Истекает: {date}",
    "market.joinMarket": "Вступить",
    "market.joinRequestAlreadySent": " · Запрос уже отправлен",
    "market.leaveMarket": "Выйти из рынка",
    "market.limitWithAmount": "Лимит {amount}",
    "market.loading": "Загрузка...",
    "market.logo": "Логотип",
    "market.managementDescription": "Параметры рынка, исходящие приглашения и передача владения",
    "market.managementLoadFailed": "Не удалось загрузить управление рынком",
    "market.managementOwnerOnly": "Управление доступно только владельцу рынка.",
    "market.managementTitle": "Управление рынком",
    "market.marketNotFound": "Рынок не найден или нет доступа.",
    "market.membershipDescription": "Информация о текущем рынке и выход из него",
    "market.membershipHint": "Публичный рынок: мгновенное вступление. Приватный рынок: отправка запроса владельцу.",
    "market.membershipTitle": "Текущее членство",
    "market.modeBan": "Запрет",
    "market.modeCap": "Лимит",
    "market.modeColumn": "Режим",
    "market.nameLabel": "Название",
    "market.noAlerts": "Нет алертов.",
    "market.noInvites": "Приглашений нет.",
    "market.noOutgoingInvites": "Исходящих приглашений пока нет.",
    "market.noValidSanctionRules": "Нет валидных правил для применения",
    "market.notMember": "Ваша страна сейчас не состоит в рынке.",
    "market.outgoingInvites": "История исходящих приглашений",
    "market.ownerChanged": "Владелец рынка изменен",
    "market.ownerLabel": "Владелец: {country}",
    "market.ownerWarningBody": "Для выхода сначала передайте владение рынком в модалке «Управление».",
    "market.ownerWarningTitle": "Вы владелец рынка",
    "market.period": "Период: {from}-{to}",
    "market.reject": "Отклонить",
    "market.ruleCapRequired": "Лимит > 0",
    "market.ruleGoodRequired": "Выберите товар",
    "market.sanctionApplyFailed": "Не удалось применить санкции",
    "market.sanctionBuilder": "Конструктор санкций",
    "market.sanctionBuilderDescription": "Выберите цель, товары и режим ограничения",
    "market.sanctionDeleted": "Санкция удалена",
    "market.sanctionDeleteFailed": "Не удалось удалить санкцию",
    "market.sanctionList": "Список санкций",
    "market.sanctionsAdded": "Добавлено санкций: {count}",
    "market.sanctionsDescription": "Конструктор правил импорта/экспорта с пакетным применением",
    "market.sanctionsListDescription": "Действующие и завершенные ограничения рынка",
    "market.sanctionsListTitle": "Санкции",
    "market.sanctionsLoadFailed": "Не удалось загрузить санкции",
    "market.sanctionsOwnerOnly": "Санкции может изменять только владелец рынка.",
    "market.sanctionsTitle": "Санкции рынка",
    "market.sanctionUpdateFailed": "Не удалось обновить санкцию",
    "market.save": "Сохранить",
    "market.selectCountry": "Выберите страну",
    "market.selectedMarketSummary": "Владелец: {owner} · Участников: {members}{pending}",
    "market.selectMarket": "Выберите рынок",
    "market.selectNewOwner": "Выберите нового владельца",
    "market.selectTarget": "Выберите цель",
    "market.sendInvite": "Отправить приглашение",
    "market.sendInviteTooltip": "Отправить приглашение в рынок",
    "market.sendRequest": "Отправить запрос",
    "market.settingsSection": "Параметры рынка",
    "market.statusActive": "ACTIVE",
    "market.statusAll": "Все",
    "market.statusExpired": "EXPIRED",
    "market.statusPaused": "PAUSED",
    "market.stepConfirm": "3. Подтверждение",
    "market.stepGoods": "2. Товары",
    "market.stepTarget": "1. Цель",
    "market.targetCountry": "Страна",
    "market.targetLabel": "Цель: {target}",
    "market.targetMarket": "Рынок",
    "market.targetSelectTooltip": "Конкретная цель санкций.",
    "market.targetTypeCountry": "Цель: страна",
    "market.targetTypeMarket": "Цель: рынок",
    "market.targetTypeTooltip": "Кого санкционируем: страну или целый рынок.",
    "market.targetValue": "{type}: {target}",
    "market.transfer": "Передать",
    "market.transferFailed": "Не удалось передать владение",
    "market.transferOwnership": "Передача владения рынком",
    "market.transferOwnerTooltip": "Передать право управления рынком выбранной стране",
    "market.turnsLeft": "осталось {turns} ход.",
    "market.updateFailed": "Не удалось обновить рынок",
    "market.updateSuccess": "Параметры рынка обновлены",
    "market.visibilityLabel": "Видимость",
    "market.visibilityMembers": "Видимость: {visibility} · Участников: {members}",
    "market.visibilityPrivate": "Приватный",
    "market.visibilityPublic": "Публичный",
    "market.worldMarkets": "Рынки мира",
    "population.countryTitle": "Население: {country}",
    "population.worldTitle": "Население мира",
    "population.countryRegionSubtitle": "Статистика по вашим регионам",
    "population.worldRegionSubtitle": "Сводная статистика по всем регионам",
    "population.groupsByRegion": "Pop-группы по регионам",
    "population.regionColumn": "Регион",
    "population.regionsInScope": "Регионов в расчете",
    "population.noNegativeRegionBalance": "Нет регионов с отрицательным балансом {turns} ход. подряд",
    "population.negativeRegionBalanceAlert": "{region}: отрицательный баланс {turns} ход. подряд ({balance} дукат/ход)",
    "population.noLowRegionCapital": "Нет регионов с критично низким капиталом на душу",
    "population.lowRegionCapitalAlert": "{region}: низкий капитал на душу ({capital} дукат/чел.)",
    "population.aggregatedData": "Агрегированные данные по населению",
    "population.balance": "Баланс",
    "population.brandingDescription": "Подготовка визуальных настроек панели населения",
    "population.brandingTitle": "Логотип и стиль",
    "population.births": "Рождения",
    "population.birthsDeaths": "Рождения / смерти",
    "population.birthsDeathsShort": "Рожд./Смерт.",
    "population.budgetEnough": "Бюджета населения хватает",
    "population.categoryBasic": "Базовые",
    "population.categoryComfort": "Комфорт",
    "population.categoryLuxury": "Роскошь",
    "population.categorySurvival": "Выживание",
    "population.categoryColumn": "Категория",
    "population.comfortShort": "Комф.",
    "population.coverage": "Покрытие",
    "population.cultureColumn": "Культура",
    "population.deaths": "Смерти",
    "population.dimensionCultures": "Культуры",
    "population.dimensionIdeologies": "Идеологии",
    "population.dimensionProfessions": "Профессии",
    "population.dimensionRaces": "Расы",
    "population.dimensionReligions": "Религии",
    "population.ducats": "дукат",
    "population.dominantReligion": "Доминирующая религия",
    "population.expenseColumn": "Расход",
    "population.financeDescription": "Казна населения, доходы/расходы за ход и сигналы по рискам",
    "population.financeAlerts": "Сигналы (алерты)",
    "population.financeTitle": "Финансы населения",
    "population.flowGoodsExpense": "Покупка товаров населением",
    "population.flowOtherExpense": "Прочие траты",
    "population.flowOtherIncome": "Прочие источники",
    "population.flowTaxes": "Налоги/сборы",
    "population.flowTransfers": "Соцвыплаты/трансферты",
    "population.flowWages": "Зарплаты от зданий",
    "population.incomePerTurn": "Доходы населения за ход",
    "population.incomeStructure": "Структура доходов",
    "population.largestCulture": "Крупнейшая культура",
    "population.lastTurnChange": "Изменение за последний ход",
    "population.legendCount": "Легенда ({count})",
    "population.loyalists": "Лоялисты",
    "population.marketDeficitGoods": "Рыночный дефицит товаров",
    "population.marketGoodsAvailable": "Товары на рынке в целом доступны",
    "population.needBudgetShortage": "Нехватка денег на потребности",
    "population.netBalance": "Чистый баланс",
    "population.noData": "Нет данных",
    "population.openTabPrompt": "Откройте вкладку {tab} для детальной статистики.",
    "population.panelTitle": "Панель населения",
    "population.peopleCount": "{count} чел.",
    "population.popGroupsDescription": "Группы идентичности: культура, религия, раса и агрегаты по внутренним профессиям",
    "population.popGroupsTitle": "Pop-группы",
    "population.professionColumn": "Профессия",
    "population.professionNeedsDescription": "Покрытие по категориям, дефицитные товары, SoL и демография по профессиям внутри pop-групп",
    "population.professionNeedsTitle": "Профессии и потребности",
    "population.professionsByPopGroups": "Профессии по pop-группам",
    "population.professionsShort": "Проф.",
    "population.raceColumn": "Раса",
    "population.radicals": "Радикалы",
    "population.radicalsLoyalists": "Радикалы / лоялисты",
    "population.radicalsLoyalistsShort": "Рад./Лоял.",
    "population.religionColumn": "Религия",
    "population.required": "Нужно",
    "population.scope": "Область",
    "population.scopeCountry": "Страна",
    "population.scopeWorld": "Мир",
    "population.sectionBranding": "Логотип и стиль",
    "population.sectionCultures": "Культуры",
    "population.sectionFinance": "Финансы населения",
    "population.sectionGeneral": "Основная информация",
    "population.sectionGroups": "Группы",
    "population.sectionIdeologies": "Идеологии",
    "population.sectionNeeds": "Потребности",
    "population.sectionProfessions": "Профессии",
    "population.sectionRaces": "Расы",
    "population.sectionReligions": "Религии",
    "population.status": "Статус",
    "population.satisfactionShort": "Удовл.",
    "population.sizeColumn": "Численность",
    "population.survivalShort": "Выж.",
    "population.totalCapital": "Общий капитал населения",
    "population.totalExpenses": "Расходы населения за ход",
    "population.totalPopulation": "Всего населения",
    "population.visualReserved": "Раздел зарезервирован под будущие механики визуализации населения.",
    "population.expenseStructure": "Структура расходов",
    "population.fulfilled": "Куплено",
    "population.groupColumn": "Группа",
    "population.wallet": "Кошелек",
    "buildings.regionRequired": "Не выбран регион",
    "buildings.regionDependency": "Нужно здание в регионе: {building}",
    "buildings.ownRegionOnlyDemolish": "Снос доступен только в ваших регионах",
    "buildings.ownRegionOnlyUpgrade": "Апгрейд доступен только в ваших регионах",
    "buildings.ownRegionOnlyToggle": "Переключение доступно только в ваших регионах",
    "buildings.ownRegionOnlyRename": "Переименование доступно только в ваших регионах",
    "buildings.duplicateNameInRegion": "Такое название уже используется в этом регионе",
    "buildings.modalDescription": "Все построенные здания по регионам",
    "buildings.sortRegion": "Сорт: регион",
    "buildings.filterRegionAll": "Регион: все",
    "buildings.regionLabel": "Регион:",
    "buildings.extractedResourceTooltip": "Ресурс, добытый зданием из залежей региона за ход",
    "buildings.buildCountryTooltip": "Страна, в регионах которой планируется строительство. По умолчанию выбрана ваша страна.",
    "buildings.selectedRegionTooltip": "Выбранный регион применяется ко всем добавляемым проектам из списка ниже.",
    "buildings.selectedRegionLabel": "Регион",
    "buildings.selectRegion": "Выберите регион",
    "buildings.confirmRegion": "Регион:",
    "buildings.renamePrompt": "Постройка: {building}\nРегион: {region}",
    "buildings.filterActivityActive": "Активные",
    "buildings.filterActivityAll": "Активность: все",
    "buildings.filterActivityInactive": "Неактивные",
    "buildings.filterBuildingAll": "Здание: все",
    "buildings.filterCompanyAll": "Компания: все",
    "buildings.filterCompanyCountryAll": "Страна компании: все",
    "buildings.filterEconomyAll": "Экономика: все",
    "buildings.filterEconomyLoss": "Убыточные",
    "buildings.filterEconomyProfit": "Прибыльные",
    "buildings.filterIndustryAll": "Отрасль: все",
    "buildings.filterSectorAll": "Сектор: все",
    "buildings.filterStatusAll": "Статус: все",
    "buildings.filterStatusBuilt": "Построенные",
    "buildings.filterStatusConstruction": "Строящиеся",
    "buildings.filters": "Фильтры",
    "buildings.industryTitle": "Индустрия",
    "buildings.openConstruction": "Открыть строительство",
    "buildings.regionCounts": "Построек: {built}, в очереди: {queued}",
    "buildings.resetFilters": "Сбросить фильтры",
    "buildings.sortBuilding": "Сорт: здание",
    "buildings.sortCompany": "Сорт: компания",
    "buildings.sortIndustry": "Сорт: отрасль",
    "buildings.sortSector": "Сорт: сектор",
    "buildings.addToQueueTitle": "Добавить «{building}» в очередь строительства",
    "buildings.addBuildingCta": "Добавить постройку",
    "buildings.addBuildingHint": "Быстрый переход к строительству",
    "buildings.available": "Доступно",
    "buildings.availableBuildings": "Доступные здания",
    "buildings.availableConstructionTooltip": "Очки строительства страны.",
    "buildings.availableDucatsTooltip": "Дукаты страны.",
    "buildings.availableConstruction": "Доступно",
    "buildings.buildingDescriptionMissing": "Описание здания отсутствует.",
    "buildings.buildingInactive": "Здание не работает",
    "buildings.buildingCash": "Касса здания",
    "buildings.buildingCashTooltip": "Накоплено денег у здания",
    "buildings.buildingFallbackName": "Здание",
    "buildings.buildingLabel": "Здание:",
    "buildings.buildCountry": "Страна строительства",
    "buildings.cancelPendingProjectTooltip": "Отменить проект до резолва текущего хода",
    "buildings.cancelQueuedProjectTooltip": "Удалить проект из очереди строительства",
    "buildings.cancelConstructionTitle": "Отменить строительство?",
    "buildings.cancelConstructionTooltip": "Отменить строительство",
    "buildings.constructionCost": "Стоимость строительства",
    "buildings.constructionParameters": "Общие параметры строительства",
    "buildings.constructionPointsUnit": "очков строительства",
    "buildings.constructionProgress": "Прогресс: {value}%",
    "buildings.constructionQueue": "Очередь строительства",
    "buildings.constructionQueueEmpty": "Очередь пуста",
    "buildings.constructionQueueTooltip": "Количество проектов в очереди строительства, включая pending текущего хода.",
    "buildings.constructionTitle": "Строительство",
    "buildings.consumes": "Потребляет",
    "buildings.costLabel": "Стоимость:",
    "buildings.countryLabel": "Страна:",
    "buildings.countryDenied": "Страна находится в списке запрета",
    "buildings.countryLimitReached": "Достигнут лимит для страны ({current}/{limit})",
    "buildings.countryNotAllowed": "Страна не входит в список разрешенных",
    "buildings.customNameLabel": "Название:",
    "buildings.customNameMissing": "не задано",
    "buildings.demolishBuildingTitle": "Снести постройку?",
    "buildings.demolishConstructionCost": "Стоимость сноса:",
    "buildings.demolishTooltip": "Снести постройку целиком. Требует очки строительства.",
    "buildings.disableAutoUpgradeTooltip": "Выключить автоповышение за счет здания",
    "buildings.disableManualWorkTooltip": "Отключить постройку вручную",
    "buildings.disableSubsidiesTooltip": "Выключить государственные субсидии",
    "buildings.durabilityLabel": "Прочность: {value}%",
    "buildings.durabilityTooltip": "Прочность: {value}%. Ограничивает максимальную производительность здания.",
    "buildings.enableAutoUpgradeTooltip": "Включить автоповышение за счет здания",
    "buildings.enableManualWorkTooltip": "Включить постройку вручную",
    "buildings.enableSubsidiesTooltip": "Включить государственные субсидии",
    "buildings.extraction": "добыча",
    "buildings.fertility": "плодородие",
    "buildings.finance": "Финансы",
    "buildings.financeGoodsPurchase": "Закупка товаров",
    "buildings.financeUpgrade": "Повышение уровня",
    "buildings.factualAmount": "Фактически: {value}",
    "buildings.globalLimitReached": "Достигнут глобальный лимит ({current}/{limit})",
    "buildings.inputGoodsCost": "Входные товары",
    "buildings.inputGoodTooltip": "Входной товар, который здание закупает для производства",
    "buildings.inputCostTooltip": "Стоимость закупки входного товара за ход",
    "buildings.industryDescriptionMissing": "Описание отрасли отсутствует.",
    "buildings.industryLabel": "Отрасль:",
    "buildings.inactiveLabel": "Неактивное",
    "buildings.inactiveLossNotCovered": "Недостаточно дукатов: убыток не покрывается кассой здания",
    "buildings.instanceMissing": "Инстанс здания не найден",
    "buildings.levelLabel": "Уровень:",
    "buildings.limitingFactor": "Лимит: {factor} {value}%",
    "buildings.limitingFactorLabel": "Лимит-фактор: {factor} ({value}%)",
    "buildings.limitingFactor.durability": "прочность",
    "buildings.limitingFactor.extraction": "добыча",
    "buildings.limitingFactor.finance": "финансы",
    "buildings.limitingFactor.infrastructure": "инфраструктура",
    "buildings.limitingFactor.inputs": "входные товары",
    "buildings.limitingFactor.labor": "труд",
    "buildings.manualDisabledReason": "Отключено вручную",
    "buildings.maxAmount": "Максимально: {value}",
    "buildings.maxDurability": "Прочность",
    "buildings.maxLevel": "Макс. уровень",
    "buildings.netPerTurn": "Итог за ход",
    "buildings.netPerTurnTooltip": "Финансовый результат здания за ход, прибыль или убыток",
    "buildings.noExtraction": "Нет добычи",
    "buildings.noInputs": "Нет входных товаров",
    "buildings.noOutputs": "Нет выходных товаров",
    "buildings.otherIndustry": "Другое",
    "buildings.owner": "Владелец",
    "buildings.ownerCompany": "Компания",
    "buildings.ownerCompanyMissing": "Не выбрана компания-владелец",
    "buildings.ownerCompanyDescriptionMissing": "Описание компании отсутствует.",
    "buildings.ownerCompanyLabel": "Компания владельца",
    "buildings.ownerCompanyTooltip": "Компания, которая станет владельцем проекта при выбранном типе «Компания».",
    "buildings.ownerCountry": "Страна владельца",
    "buildings.ownerCountryTooltip": "Страна, которая станет владельцем проекта при выбранном типе «Государство».",
    "buildings.ownerState": "Государство",
    "buildings.ownerType": "Владелец",
    "buildings.ownerTypeTooltip": "Кому будет принадлежать каждое добавленное здание: государству или компании.",
    "buildings.project": "Проект",
    "buildings.productivityLabel": "Производительность: {value}%",
    "buildings.productivityMetric": "Производительность",
    "buildings.productivityTooltip": "Производительность: {value}%. Показывает, какую долю от максимальной мощности здание отрабатывает за ход.",
    "buildings.produces": "Производит",
    "buildings.production": "Производство",
    "buildings.outputGoodTooltip": "Выходной товар, который производит здание",
    "buildings.outputIncomeTooltip": "Доход от продажи выходного товара за ход",
    "buildings.projectBuild": "Новое здание",
    "buildings.projectUpgrade": "Повышение уровня",
    "buildings.requirements": "Условия",
    "buildings.requirementsCannotAdd": "Нет {reason}",
    "buildings.requirementsCanAdd": "Да, можно добавить в очередь строительства",
    "buildings.requiresDeposit": "требует залежь",
    "buildings.requiredTechnology": "Нужна технология: {technology}",
    "buildings.regionFiltersEmpty": "По выбранным фильтрам ничего не найдено.",
    "buildings.renameBuildingHint": "Пустое значение сбросит пользовательское название",
    "buildings.renameBuildingLabel": "Уникальное название, до 80 символов",
    "buildings.renameBuildingPlaceholder": "Введите уникальное название",
    "buildings.renameBuildingTitle": "Изменение названия постройки",
    "buildings.renameSave": "Сохранить",
    "buildings.renameTooltip": "Изменить уникальное название постройки",
    "buildings.sectorDescriptionMissing": "Описание сектора отсутствует.",
    "buildings.sectorLabel": "Сектор:",
    "buildings.salesRevenue": "Доход от продаж",
    "buildings.selectCompany": "Выберите компанию",
    "buildings.selectCountry": "Выберите страну",
    "buildings.startingCapital": "Стартовый капитал",
    "buildings.statuses": "Статусы",
    "buildings.stateSubsidies": "Госсубсидии",
    "buildings.stateSubsidiesTooltip": "Сумма государственных субсидий, полученных зданием за ход",
    "buildings.stock": "Склад",
    "buildings.stockAvailable": "В наличии: {value}",
    "buildings.stockEmpty": "пусто",
    "buildings.stockIncoming": "Пришло: {value}",
    "buildings.stockOutgoing": "Ушло: {value}",
    "buildings.stockRemainder": "Остаток: {value}",
    "buildings.statusStopped": "Остановлено",
    "buildings.statusWorking": "Работает",
    "buildings.toastAutoUpgradeDisabled": "Автоповышение за счет здания выключено",
    "buildings.toastAutoUpgradeEnabled": "Автоповышение за счет здания включено",
    "buildings.toastAutoUpgradeFailed": "Не удалось изменить режим автоповышения",
    "buildings.toastBuildCancelFailed": "Не удалось отменить строительство",
    "buildings.toastBuildCanceled": "Строительство отменено",
    "buildings.toastBuildNotFound": "Проект уже не найден",
    "buildings.toastDemolishFailed": "Не удалось снести постройку",
    "buildings.toastDemolished": "Постройка снесена ({cost} очков строительства)",
    "buildings.toastDemolishInsufficientConstruction": "Недостаточно очков строительства для сноса",
    "buildings.toastDemolishNotFound": "Постройка уже отсутствует",
    "buildings.toastManualWorkDisabled": "Постройка отключена вручную",
    "buildings.toastManualWorkEnabled": "Постройка включена вручную",
    "buildings.toastManualWorkFailed": "Не удалось изменить ручной режим постройки",
    "buildings.toastRenameFailed": "Не удалось обновить название постройки",
    "buildings.toastRenameReset": "Название постройки сброшено",
    "buildings.toastRenameUpdated": "Название постройки обновлено",
    "buildings.toastSubsidiesDisabled": "Государственные субсидии выключены",
    "buildings.toastSubsidiesEnabled": "Государственные субсидии включены",
    "buildings.toastSubsidiesFailed": "Не удалось изменить режим субсидий",
    "buildings.toastUpgradeAlreadyQueued": "Апгрейд этого здания уже в очереди",
    "buildings.toastUpgradeFailed": "Не удалось поставить апгрейд в очередь",
    "buildings.toastUpgradeInsufficientDucats": "Недостаточно дукатов государства для апгрейда",
    "buildings.toastUpgradeMaxReached": "Достигнут максимальный уровень здания",
    "buildings.toastUpgradeQueued": "Апгрейд поставлен в очередь: Ур. {current} -> {target}",
    "buildings.tradeAmount": "Объем: {value}",
    "buildings.tradeBuyTooltip": "Покупка входных товаров за ход",
    "buildings.tradeEmpty": "пусто",
    "buildings.tradeExpense": "Расход: {value} дукат",
    "buildings.tradeExpenseTooltip": "Расход на закупку за ход",
    "buildings.tradeIncome": "Доход: {value} дукат",
    "buildings.tradeIncomeTooltip": "Доход от продажи за ход",
    "buildings.tradeSellTooltip": "Продажа выходных товаров за ход",
    "buildings.tradeTurn": "Торговля за ход",
    "buildings.unavailable": "Недоступно",
    "buildings.upgradeAlreadyQueuedReason": "Апгрейд уже в очереди",
    "buildings.upgradeBlockedTooltip": "Нельзя повысить: {reason}",
    "buildings.upgradeByStateTooltip": "Повысить уровень за счет государства ({construction} строительства, {ducats} дукатов)",
    "buildings.upgradeDucatsNeeded": "Нужно дукатов: {value}",
    "buildings.upgradeMaxReached": "Достигнут максимум: Ур. {level}",
    "buildings.wages": "Зарплаты",
    "buildings.workforce": "Рабочая сила",
    "buildings.workersLabel": "Рабочие:",
    "budget.category.baseIncome": "Базовый доход государства",
    "budget.category.colonization": "Поддержка колонизаций",
    "budget.category.construction": "Строительные проекты",
    "budget.category.customization": "Кастомизация страны",
    "budget.category.provinceRename": "Переименование провинций",
    "budget.category.subsidies": "Государственные субсидии",
    "budget.chart.expenses": "Расходы",
    "budget.chart.expensesByCategory": "График расходов по категориям",
    "budget.chart.income": "Доходы",
    "budget.chart.incomeByCategory": "График доходов по категориям",
    "budget.history.expenses": "Расходы",
    "budget.history.income": "Доходы",
    "budget.history.net": "Итог",
    "budget.history.projected": "Прогноз",
    "budget.history.treasury": "Казна",
    "budget.metric.currentTreasury": "Казна сейчас",
    "budget.metric.net": "Итог: {value}",
    "budget.metric.projectedEnd": "Прогноз на конец хода",
    "budget.metric.turnExpenses": "Расходы за ход",
    "budget.metric.turnIncome": "Доходы за ход",
    "budget.subsidies.empty": "В этом ходу субсидий не выплачено.",
    "budget.subsidies.paidThisTurn": "Выплачено субсидий в этом ходу",
    "budget.subsidies.region": "Region ID: {region}",
    "budget.tab.expenses": "Расходы",
    "budget.tab.history": "История",
    "budget.tab.subsidies": "Субсидии",
    "budget.tab.summary": "Сводка",
    "budget.table.amount": "Сумма",
    "budget.table.category": "Категория",
    "budget.table.expensesByCategory": "Расходы по категориям",
    "budget.table.incomeByCategory": "Доходы по категориям",
    "budget.title": "Бюджет дукатов государства",
    "budget.total.expenses": "Итого расходов",
    "budget.total.income": "Итого доходов",
    "provinceContext.openColonization": "Открыть колонизацию",
    "provinceContext.openProvinceKnowledge": "Статья о провинции",
    "provinceContext.createProvinceKnowledge": "Создать статью о провинции",
    "provinceContext.openAdminEditor": "Управление провинцией",
    "shell.action.army": "Командовать армией",
    "shell.action.armyDescription": "Открыть соединения, маршруты и военные приказы.",
    "shell.action.budget": "Бюджет страны",
    "shell.action.budgetDescription": "Проверить казну, субсидии и расходы текущего хода.",
    "shell.action.buildings": "Строительство региона",
    "shell.action.buildingsDescription": "Открыть здания выбранного региона и очередь строительства.",
    "shell.action.customization": "Облик страны",
    "shell.action.customizationDescription": "Изменить название, цвета, флаг и герб.",
    "shell.action.decisions": "Решения",
    "shell.action.decisionsDescription": "Посмотреть доступные решения страны.",
    "shell.action.diplomacy": "Дипломатическая карта",
    "shell.action.diplomacyDescription": "Открыть отношения, предложения и дипломатические действия.",
    "shell.action.events": "Лента истории",
    "shell.action.eventsDescription": "Открыть события страны и повествовательный журнал.",
    "shell.action.globalMarket": "Глобальный рынок",
    "shell.action.globalMarketDescription": "Сравнить товары и цены по миру.",
    "shell.action.market": "Рынок страны",
    "shell.action.marketDescription": "Посмотреть товары, цены, дефициты и давление рынка.",
    "shell.action.modifiers": "Модификаторы",
    "shell.action.modifiersDescription": "Проверить активные эффекты страны и их источники.",
    "shell.action.politics": "Политика",
    "shell.action.politicsDescription": "Открыть парламент, законы и устройство власти.",
    "shell.action.population": "Общество",
    "shell.action.populationDescription": "Посмотреть население, профессии, культуру, религию и рост.",
    "shell.action.technology": "Технологии",
    "shell.action.technologyDescription": "Открыть исследования, прогресс и требования.",
    "shell.action.turnStatus": "Готовность стран",
    "shell.action.turnStatusDescription": "Проверить, кто готов к завершению текущего хода.",
    "shell.admin": "Админ",
    "shell.adminConsole": "Консоль оператора",
    "shell.adminPanel": "Админ-панель",
    "shell.availableActions": "Доступные действия",
    "shell.clientSettings": "Настройки клиента",
    "shell.codex": "Аркавики",
    "shell.connectedMessage": "Соединение с игровым сервером установлено",
    "shell.connectedTitle": "Подключение",
    "shell.countryCustomizedMessage": "Кастомизация применена для {country} (-дукаты)",
    "shell.countryCustomizedTitle": "Изменение страны",
    "shell.contentPanel": "Контент",
    "shell.dashboard.activeProjects": "Активные проекты",
    "shell.dashboard.activeResearch": "Активные исследования",
    "shell.dashboard.army": "Командное положение",
    "shell.dashboard.armyIntro": "Читайте позиции на карте и открывайте армейскую панель для приказов.",
    "shell.dashboard.availableConstruction": "Резерв строительства",
    "shell.dashboard.construction": "Работы в регионах",
    "shell.dashboard.constructionIntro": "Строительство остаётся региональным: выберите землю, затем откройте очередь.",
    "shell.dashboard.constructionSpend": "Плановые расходы",
    "shell.dashboard.controlledRegions": "Контролируемые регионы",
    "shell.dashboard.cultureReserve": "Резерв культуры",
    "shell.dashboard.diplomacy": "Внешняя канцелярия",
    "shell.dashboard.diplomacyIntro": "Читайте отношения на карте и открывайте переговоры по выбранной стране.",
    "shell.dashboard.ducatFlow": "Поток дукатов",
    "shell.dashboard.goldReserve": "Запас золота",
    "shell.dashboard.governance": "Канцелярия страны",
    "shell.dashboard.governanceIntro": "Политика, исследования, решения и события собраны в одном офисе страны.",
    "shell.dashboard.market": "Давление рынка",
    "shell.dashboard.marketIntro": "Следите за товарами, ценами, резервами и движением казны до детализации.",
    "shell.dashboard.notifications": "Уведомления",
    "shell.dashboard.overview": "Реестр державы",
    "shell.dashboard.overviewIntro": "Краткий вид первого хода: деньги, решения и ближайшие проверки.",
    "shell.dashboard.pendingDecisions": "Ожидают решения",
    "shell.dashboard.population": "Реестр общества",
    "shell.dashboard.populationIntro": "Режим населения начинается со страны, затем уходит в выбранные регионы.",
    "shell.dashboard.religionReserve": "Резерв религии",
    "shell.dashboard.scienceReserve": "Резерв науки",
    "shell.dashboard.scienceSpend": "Наука вложена",
    "shell.dashboard.totalPopulation": "Всего населения",
    "shell.dashboard.treasury": "Казна",
    "shell.endTurn": "Завершить ход",
    "shell.entryCountryProfile": "Профиль страны",
    "shell.entryEnterGame": "Войти в игру",
    "shell.entryLoadedDescription": "Можно входить в игру",
    "shell.entryLoadedTitle": "Данные загружены",
    "shell.entryLoading": "загрузка",
    "shell.entryLoadingDescription": "Подготавливаем карту, настройки и состояние вашей страны",
    "shell.entryLoadingStatus": "Загрузка данных игры",
    "shell.entryReadyStatus": "готово",
    "shell.entryProvinceIndex": "Провинции",
    "shell.entryPublicUi": "UI-настройки",
    "shell.entryWorldState": "Состояние мира",
    "shell.forceResolve": "Форсировать ход",
    "shell.gameSettings": "Настройки игры",
    "shell.globalMarketTitle": "Глобальный рынок",
    "shell.localStateMissing": "Локальный state отсутствует, выполняется snapshot-ресинк",
    "shell.loginMessage": "Вы вошли в страну {country}",
    "shell.loginTitle": "Вход",
    "shell.logout": "Выйти",
    "shell.logoutMessage": "Сессия игрока завершена",
    "shell.logoutToast": "Вы вышли из страны",
    "shell.logoutTitle": "Выход",
    "shell.mapLens.army": "Военные формирования и перемещение",
    "shell.mapLens.construction": "Нагрузка инфраструктуры и маршруты",
    "shell.mapLens.diplomacy": "Договоры и внешнее влияние",
    "shell.mapLens.governance": "Госрегионы и управление",
    "shell.mapLens.market": "Состав рынков и столицы",
    "shell.mapLens.overview": "Политическое владение",
    "shell.mapLens.population": "Плотность населения и общество",
    "shell.mapLens.title": "Линза карты",
    "shell.metric.area": "{area} км²",
    "shell.metric.colonies": "Колонии",
    "shell.metric.population": "Население",
    "shell.metric.regions": "Регионы",
    "shell.mode.army": "Армия",
    "shell.mode.armyDescription": "Командный режим карты для соединений, маршрутов и операций.",
    "shell.mode.construction": "Строительство",
    "shell.mode.constructionDescription": "Региональное управление зданиями, очередями, стоимостью и ограничениями.",
    "shell.mode.diplomacy": "Дипломатия",
    "shell.mode.diplomacyDescription": "Карта отношений, предложений, договоров и внешних действий.",
    "shell.mode.governance": "Управление",
    "shell.mode.governanceDescription": "Канцелярия страны: политика, технологии, решения, события и модификаторы.",
    "shell.mode.market": "Рынок",
    "shell.mode.marketDescription": "Сводка товаров, цен, дефицитов, излишков и рыночного давления.",
    "shell.mode.overview": "Обзор",
    "shell.mode.overviewDescription": "Сводка страны поверх карты: ресурсы, проблемы, готовность и приоритеты.",
    "shell.mode.population": "Население",
    "shell.mode.populationDescription": "Общество страны: pops, профессии, культуры, религии и потребности.",
    "shell.modeDock": "Режимы карты",
    "shell.notifications": "Уведомления",
    "shell.orderColonizationTitle": "Новый приказ колонизации",
    "shell.orderArmyMoveMessage": "Передислокация дивизии {division} в {province}",
    "shell.orderSent": "Приказ отправлен",
    "shell.orderTitle": "Новый приказ",
    "shell.preview.activeResearchDetail": "Текущие направления технологий",
    "shell.preview.armyLedger": "Армейская сводка",
    "shell.preview.averageOrganization": "Средняя организация",
    "shell.preview.averageOrganizationDetail": "По полевым дивизиям",
    "shell.preview.bills": "Законопроекты",
    "shell.preview.billsDetail": "Повестка парламента",
    "shell.preview.constructionQueue": "Очередь строительства",
    "shell.preview.diplomacyLedger": "Дипломатический стол",
    "shell.preview.divisions": "Дивизии",
    "shell.preview.formationQueue": "Очередь формирования",
    "shell.preview.formationQueueDetail": "Формируемые части",
    "shell.preview.governanceLedger": "Реестр канцелярии",
    "shell.preview.marketLedger": "Реестр рынка",
    "shell.preview.noArmy": "Полевых дивизий и формирований пока нет.",
    "shell.preview.noConstruction": "Нет активных строительных проектов в контролируемых регионах.",
    "shell.preview.noDiplomacy": "Нет видимых дипломатических предложений с участием вашей страны.",
    "shell.preview.noGovernance": "Записи управления пока недоступны.",
    "shell.preview.noMarket": "Рыночная сводка пока недоступна.",
    "shell.preview.noPopulation": "В контролируемых регионах пока нет доступного населения.",
    "shell.preview.noStories": "Пока нет свежих историй страны.",
    "shell.preview.open": "Открыть",
    "shell.preview.outboundProposals": "Исходящие предложения",
    "shell.preview.outboundProposalsDetail": "Отправленные переговоры ещё открыты",
    "shell.preview.pendingResponse": "Ожидают ответа",
    "shell.preview.pendingResponseDetail": "Договоры ждут вашего решения",
    "shell.preview.populationLedger": "Реестр общества",
    "shell.preview.populationTotal": "Население",
    "shell.preview.records": "Записи",
    "shell.preview.recordsDetail": "Записи решений и событий",
    "shell.preview.relatedTreaties": "Связанные договоры",
    "shell.preview.relatedTreatiesDetail": "Все видимые предложения с вашим участием",
    "shell.preview.storyFeed": "Лента истории",
    "shell.preview.subsidies": "Субсидии",
    "shell.preview.topCulture": "Крупнейшая культура",
    "shell.preview.topProfession": "Крупнейшая профессия",
    "shell.resource.colonization": "Колонизация",
    "shell.resource.construction": "Строительство",
    "shell.resource.culture": "Культура",
    "shell.resource.ducats": "Дукаты",
    "shell.resource.gold": "Золото",
    "shell.resource.religion": "Религия",
    "shell.resource.science": "Наука",
    "sideNav.army": "Армия",
    "sideNav.budget": "Бюджет",
    "sideNav.buildings": "Постройки",
    "sideNav.decisions": "Решения",
    "sideNav.diplomacy": "Дипломатия",
    "sideNav.events": "События",
    "sideNav.globalMarket": "Глобальный рынок",
    "sideNav.intel": "Спецслужбы",
    "sideNav.market": "Рынок",
    "sideNav.modifiers": "Модификаторы",
    "sideNav.politics": "Политика",
    "sideNav.population": "Население",
    "sideNav.technology": "Технологии",
    "sideNav.trade": "Торговля",
    "topBar.adminForceResolve": "Админ: форс-резолв",
    "topBar.clientSettings": "Настройки клиента",
    "topBar.colonizationLimit": "Лимит колонизаций",
    "topBar.contentPanel": "Панель контента",
    "topBar.controlledProvinces": "Провинций под контролем",
    "topBar.countryDetails": "Детали страны и её владений",
    "topBar.currentTurn": "Текущий ход",
    "topBar.currentValue": "Текущее значение",
    "topBar.expensePerTurn": "Расход за ход",
    "topBar.gameSettings": "Настройки игры",
    "topBar.growthPerTurn": "Прирост за ход",
    "topBar.knowledgeBase": "Хранилище знаний",
    "topBar.logout": "Выход",
    "topBar.netGrowth": "Чистый прирост",
    "topBar.netPerTurn": "Итог за ход",
    "topBar.nextTurn": "Следующий ход #{turn}",
    "topBar.openCountryDetails": "Открыть детали страны",
    "topBar.openResourceDetails": "{resource}: открыть детали",
    "topBar.populationAria": "Население: {population}, прирост {growth}",
    "topBar.populationDescription": "Общее население, рождаемость и смертность за последний ход",
    "topBar.resourceTip.colonization": "Очки колонизации за ход",
    "topBar.resourceTip.construction": "Очки строительства для производственных приказов",
    "topBar.resourceTip.culture": "Очки культуры для развития традиций",
    "topBar.resourceTip.ducats": "Планировочный бюджет текущего хода",
    "topBar.resourceTip.gold": "Госказна для больших проектов",
    "topBar.resourceTip.religion": "Религия влияет на стабильность и миссии",
    "topBar.resourceTip.science": "Очки науки ускоряют исследования",
    "topBar.time.day": "д",
    "topBar.time.hour": "ч",
    "topBar.time.minute": "м",
    "topBar.time.second": "с",
    "topBar.totalArea": "Общая площадь",
    "textInput.emptyResets": "Пустое значение сбрасывает поле",
    "shell.readiness.empty": "Статусы готовности стран пока не видны.",
    "shell.readiness.offline": "Оффлайн",
    "shell.readiness.online": "Онлайн",
    "shell.readiness.progress": "Готово {ready}/{required}",
    "shell.readiness.status.blocked": "Заблокирована",
    "shell.readiness.status.ignored": "Пропускается",
    "shell.readiness.status.ready": "Готова",
    "shell.readiness.status.waiting": "Ожидает",
    "shell.readiness.title": "Готовность стран",
    "shell.rejectedOrders": "Отклонено приказов: {count}",
    "shell.rejectedOrdersMessage": "Отклонено приказов: {count}",
    "shell.registrationAlreadyReviewed": "Заявка уже обработана",
    "shell.registrationApproved": "Регистрация подтверждена",
    "shell.registrationReviewPrompt": "Подтвердить регистрацию этой страны и разрешить вход в игру?",
    "shell.registrationReviewTitle": "Подтверждение регистрации страны",
    "shell.registrationReviewUnavailable": "Данные заявки недоступны.",
    "shell.registrationRejected": "Регистрация отклонена",
    "shell.registrationReviewFailed": "Не удалось обработать заявку",
    "shell.replayRequested": "Обнаружен рассинхрон версии, запрошен replay дельт",
    "shell.replayUnavailable": "Replay недоступен, выполняется snapshot-ресинк",
    "shell.resolveAutoUnconfirmed": "Авто-резолв не подтвержден сервером",
    "shell.resolveDoneDescription": "Ход #{turn} успешно обработан",
    "shell.resolveDoneTitle": "Обработка хода завершена",
    "shell.resolveDuration": "Общее время обработки",
    "shell.resolveForceDescription": "Принудительный резолв хода",
    "shell.resolveManualUnconfirmed": "Резолв не подтвержден сервером",
    "shell.resolveProcessingDescription": "Подождите, сервер выполняет резолв приказов",
    "shell.resolveProcessingTitle": "Идет обработка хода",
    "shell.resolveReturn": "Вернуться к игре",
    "shell.resolveTimeoutAutoDescription": "TURN_RESOLVE_STARTED не пришел вовремя. Действия остаются доступны.",
    "shell.resolveTimeoutManualDescription": "TURN_RESOLVE_STARTED не пришел вовремя.",
    "shell.resolveUnavailableDescription": "Во время обработки действия временно недоступны",
    "shell.scenarioApplied": "Сценарий применён",
    "shell.scenarioAppliedDescription": "Перезагружаем карту и состояние мира",
    "shell.serverErrorTitle": "Ошибка",
    "shell.eventAlreadyResolved": "Событие уже обработано",
    "shell.eventAutoResolved": "Событие решено автоматически",
    "shell.eventAutoResolvedDescription": "Из-за отсутствия решения главы государства правительство выбрало: {option}.",
    "shell.adminCommandSent": "Админ-команда отправлена",
    "shell.adminCommandTitle": "Админ-команда",
    "shell.adminOnly": "Только для администраторов",
    "shell.story.category.colonization": "Колонизация",
    "shell.story.category.diplomacy": "Дипломатия",
    "shell.story.category.economy": "Экономика",
    "shell.story.category.military": "Война",
    "shell.story.category.politics": "Политика",
    "shell.story.category.system": "Система",
    "shell.story.priority.high": "Высокий",
    "shell.story.priority.low": "Низкий",
    "shell.story.priority.medium": "Средний",
    "shell.turn": "Ход {turn}",
    "shell.turnCompletedTitle": "Ход #{turn} завершен",
    "shell.turnResolved": "Ход успешно зарезолвен",
    "shell.turnResolvedClean": "Резолв завершен без отклонений приказов",
    "shell.turnStatus": "Готовность",
    "shell.unnamedCountry": "Безымянная держава",
    "shell.worldResyncFailed": "Не удалось синхронизировать мир, выполняется перезагрузка",
    "shell.worldResynced": "Состояние мира синхронизировано заново",
    "shell.workspace": "Рабочая область",
    "turnStatus.blockedPermanent": "Заблокирована бессрочно",
    "turnStatus.blockedUntilTime": "Заблокирована до {time}",
    "turnStatus.blockedUntilTurn": "Заблокирована до хода {turn}",
    "turnStatus.lastLogin": "Последний вход: {value}",
    "turnStatus.loading": "Загрузка готовности стран...",
    "turnStatus.noLoginData": "нет данных",
    "technology.cancelResearch": "Отменить",
    "technology.description": "Описание",
    "technology.descriptionMissing": "Описание технологии не задано.",
    "technology.empty": "Технологии пока не созданы",
    "technology.loadFailed": "Не удалось загрузить технологии",
    "technology.loading": "Загрузка технологий...",
    "technology.nodeCount": "{count} узлов",
    "technology.notAvailable": "Технология пока недоступна",
    "technology.progress": "Прогресс",
    "technology.prerequisites": "Требует",
    "technology.researchAdded": "Исследование добавлено",
    "technology.researchCanceled": "Исследование отменено",
    "technology.rootTechnology": "Корневая технология.",
    "technology.scienceCost": "{cost} науки",
    "technology.selectPrompt": "Выберите технологию в дереве, чтобы посмотреть описание, требования и открытия.",
    "technology.startResearch": "Изучать",
    "technology.status.available": "Доступно",
    "technology.status.locked": "Заблокировано",
    "technology.status.notSelected": "Не выбрана",
    "technology.status.researched": "Изучено",
    "technology.status.researching": "Изучается",
    "technology.title": "Технологии",
    "technology.unlockBuildings": "Здания",
    "technology.unlockLaws": "Законы",
    "technology.unlocks": "Открывает",
    "technology.unlocksEmpty": "Нет явных открытий.",
    "technology.updateFailed": "Не удалось изменить исследование",
  },
};

const UI_LOCALE_STORAGE_KEY = "arcanorum.uiLocale";
const listeners = new Set<() => void>();
let currentLocale: UiLocale = readInitialUiLocale();

export function getUiLocale(): UiLocale {
  return currentLocale;
}

export function setUiLocale(locale: UiLocale): void {
  if (currentLocale === locale) return;
  currentLocale = locale;
  writeStoredUiLocale(locale);
  for (const listener of listeners) listener();
}

export function subscribeUiLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function tUi(key: UiTextKey, params: Record<string, string | number> = {}, locale: UiLocale = getUiLocale()): string {
  const template = uiText[locale][key];
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, paramKey: string) => {
    const value = params[paramKey];
    return value == null ? match : String(value);
  });
}

export function getUiTextCatalog(): Record<UiLocale, Record<UiTextKey, string>> {
  return uiText;
}

function readInitialUiLocale(): UiLocale {
  const stored = readStoredUiLocale();
  if (stored) return stored;
  if (typeof navigator === "undefined") return "ru";
  return navigator.language.toLowerCase().startsWith("en") ? "en" : "ru";
}

function readStoredUiLocale(): UiLocale | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(UI_LOCALE_STORAGE_KEY);
  return stored === "en" || stored === "ru" ? stored : null;
}

function writeStoredUiLocale(locale: UiLocale): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(UI_LOCALE_STORAGE_KEY, locale);
}
