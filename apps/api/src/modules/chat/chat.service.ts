import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { assertPermission } from "../../shared/permission.js";
import type { ChatMessageDTO, MessagesResponse } from "@markflow/shared";

interface ChatMessageRow {
  id: string;
  content: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
  };
}

function toChatMessageDTO(row: ChatMessageRow): ChatMessageDTO {
  return {
    id: row.id,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    user: {
      id: row.user.id,
      name: row.user.name,
    },
  };
}

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async getMessages(
    projectId: string,
    userId: string,
    limit: number,
    before?: string,
  ): Promise<MessagesResponse> {
    await assertPermission(this.prisma, projectId, userId, "VIEWER");

    const messages = await this.prisma.chatMessage.findMany({
      where: {
        projectId,
        ...(before && {
          createdAt: {
            lt: before,
          },
        }),
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });

    let nextCursor: string | null = null;
    if (messages.length > limit) {
      const nextMessage = messages.pop();
      if (nextMessage) {
        nextCursor = nextMessage.createdAt.toISOString();
      }
    }

    // Return in chronological order (oldest to newest) or keep desc?
    // API Spec says: 시간순(최신순 페이지네이션). Usually UI needs oldest first if it's a chat thread.
    // Wait, the PRD says: 최신순 페이지네이션.
    // If it's a chat, the client typically appends new messages at the bottom. So oldest to newest?
    // Let's reverse it so the client gets them in chronological order.
    // Wait, `limit=50&before=<cursor>` is used to fetch older messages when scrolling up.
    // If we order by createdAt DESC, we get the newest ones first. We should return them in DESC or ASC?
    // Let's just return what Prisma gave (DESC) but reversed so the newest is at the bottom, which is standard for chat.
    // Actually, usually chat history is rendered bottom-up or reversed. Let's stick to returning ASC order for the chunk.
    const reversedMessages = messages.reverse();

    return {
      messages: reversedMessages.map(toChatMessageDTO),
      nextCursor,
    };
  }

  async sendMessage(
    projectId: string,
    userId: string,
    content: string,
  ): Promise<ChatMessageDTO> {
    await assertPermission(this.prisma, projectId, userId, "EDITOR");

    const message = await this.prisma.chatMessage.create({
      data: {
        projectId,
        userId,
        content,
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });

    return toChatMessageDTO(message);
  }
}
