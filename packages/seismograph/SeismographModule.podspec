require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'SeismographModule'
  s.version        = package['version']
  s.summary        = 'Native accelerometer seismograph module for QuakeLink'
  s.homepage       = 'https://github.com/rodolfoquendo/emergency-response-app'
  s.license        = { :type => 'GPL-3.0-only WITH App Store exception', :file => '../../LICENSE' }
  s.authors        = { 'QuakeLink' => 'dev@quakelink.app' }
  s.platform       = :ios, '16.0'
  s.source         = { git: '' }
  s.source_files   = 'ios/**/*.{swift,m,h}'
  s.dependency 'ExpoModulesCore'
end
