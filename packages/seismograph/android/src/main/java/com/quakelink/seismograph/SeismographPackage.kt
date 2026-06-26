package com.quakelink.seismograph

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.Package

class SeismographPackage : Package {
  override fun createModules(): List<Module> = listOf(SeismographModule())
}
