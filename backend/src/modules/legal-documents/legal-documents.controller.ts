import { Controller, Get, Headers, NotFoundException, Query } from '@nestjs/common';
import { resolveLocale } from '../../common/i18n/locale';
import { LatestLegalDocumentQueryDto } from './dto/latest-legal-document-query.dto';
import { LegalDocumentsService } from './legal-documents.service';

/**
 * Public read-only access to the latest **published** legal text (e.g. signup, settings).
 *
 * | Method | Path | Query |
 * |--------|------|--------|
 * | GET | /api/legal-documents/latest | type=TERMS\|PRIVACY, optional `lang` or Accept-Language |
 */
@Controller('legal-documents')
export class LegalDocumentsController {
  constructor(private readonly service: LegalDocumentsService) {}

  @Get('latest')
  async latest(
    @Query() query: LatestLegalDocumentQueryDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const locale = resolveLocale(query.lang, acceptLanguage);
    const payload = await this.service.getLatestPublished(query.type, locale);
    if (!payload) {
      throw new NotFoundException(
        'No published legal document for this type and language',
      );
    }
    return payload;
  }
}
