import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { CursorPaginationDto } from '../common/dto/cursor-pagination.dto';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { RequestMessageMediaUploadDto } from './dto/request-message-media-upload.dto';

@ApiTags('messages')
@ApiBearerAuth()
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List your conversations, most recently active first',
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: CursorPaginationDto,
  ) {
    return this.conversationsService.listConversations(user.id, pagination);
  }

  @Get('requests')
  @ApiOperation({
    summary:
      'List pending message requests (1:1 conversations from people you don’t follow)',
  })
  listRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: CursorPaginationDto,
  ) {
    return this.conversationsService.listRequests(user.id, pagination);
  }

  @Post()
  @ApiOperation({ summary: 'Start a 1:1 or group conversation' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateConversationDto,
  ) {
    return this.conversationsService.createConversation(user.id, dto);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'List messages in a conversation' })
  listMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Query() pagination: CursorPaginationDto,
  ) {
    return this.conversationsService.listMessages(user.id, id, pagination);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message in a conversation' })
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendMessageDto,
  ) {
    return this.conversationsService.sendMessage(user.id, id, dto);
  }

  @Post(':id/media-upload-url')
  @ApiOperation({
    summary:
      'Get a presigned URL to upload image/video message media; then send it as the mediaUrl of a message',
  })
  requestMediaUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RequestMessageMediaUploadDto,
  ) {
    return this.conversationsService.requestMediaUpload(
      user.id,
      id,
      dto.mediaType,
    );
  }

  @Post(':id/accept-request')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Accept a pending message request' })
  acceptRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.conversationsService.acceptRequest(user.id, id);
  }

  @Delete(':id/reject-request')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Decline a pending message request (deletes the conversation)',
  })
  rejectRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.conversationsService.rejectRequest(user.id, id);
  }
}
