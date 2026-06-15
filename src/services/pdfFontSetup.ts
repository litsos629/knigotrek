/**
 * Регистрация шрифта Roboto с поддержкой кириллицы в jsPDF.
 * Импортируйте этот модуль один раз — все последующие экземпляры jsPDF
 * автоматически получат доступ к шрифту 'Roboto' (normal и bold).
 */
import { jsPDF } from 'jspdf'
import { RobotoRegularBase64 } from '../fonts/Roboto-Regular'
import { RobotoBoldBase64 } from '../fonts/Roboto-Bold'

const callAddFont = function (this: jsPDF) {
  this.addFileToVFS('Roboto-Regular.ttf', RobotoRegularBase64)
  this.addFileToVFS('Roboto-Bold.ttf', RobotoBoldBase64)
  this.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  this.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
}

jsPDF.API.events.push(['addFonts', callAddFont] as any)
