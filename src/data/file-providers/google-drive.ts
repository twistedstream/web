import { drive_v3 } from "@googleapis/drive";
import { Response } from "express";
import { StatusCodes } from "http-status-codes";

import { IFileProvider } from "../../types/data";
import { FileInfo, MediaType } from "../../types/entity";
import { assertValue } from "../../utils/error";
import { drive } from "../../utils/google/drive/client";
import { fileIdFromUrl } from "../../utils/google/drive/file";
import { logger } from "../../utils/logger";
import {
  fileTypeFromMediaType,
  mediaTypeFromMimeType,
} from "../../utils/media-type";

export class GoogleDriveFileProvider implements IFileProvider {
  private _initialized: boolean = false;

  constructor() {
    // bind method "this"'s to instance "this"
    this.initialize = this.initialize.bind(this);
    this.getFileInfo = this.getFileInfo.bind(this);
    this.sendFile = this.sendFile.bind(this);
  }

  // IDataProvider implementation

  async initialize(): Promise<void> {
    if (!this._initialized) {
      logger.info("Google Drive file provider initialized");
      this._initialized = true;
    }
  }

  async getFileInfo(url: string): Promise<FileInfo | undefined> {
    const fileId = fileIdFromUrl(url);
    if (!fileId) {
      return;
    }

    let data: drive_v3.Schema$File;
    try {
      const file = await drive.files.get({
        fileId,
        fields: "id,name,mimeType,exportLinks",
      });
      data = file.data;
    } catch (err: any) {
      if (err.status === StatusCodes.NOT_FOUND) {
        return;
      }
      throw err;
    }

    const mediaType = mediaTypeFromMimeType(assertValue(data.mimeType));
    if (!mediaType) {
      throw new Error(
        `Google drive file (${fileId}) has an unknown mime type: ${data.mimeType}`
      );
    }

    return {
      id: assertValue(data.id),
      title: assertValue(data.name),
      type: assertValue(fileTypeFromMediaType(mediaType)),
      availableMediaTypes: data.exportLinks
        ? Object.keys(data.exportLinks).reduce((p: MediaType[], c: string) => {
            const mediaType = mediaTypeFromMimeType(c);
            if (mediaType) {
              return [...p, mediaType];
            }
            return p;
          }, [])
        : [mediaType],
    };
  }

  async sendFile(file: FileInfo, mediaType: MediaType, destination: Response) {
    const { id: fileId } = file;
    const { name: mimeType } = mediaType;

    drive.files
      .export({ fileId, mimeType }, { responseType: "stream" })
      .then((res) => {
        const fileName = `${file.title}.${mediaType.extension}`;
        destination.attachment(fileName);

        const { data: stream } = res;
        stream.on("error", (err) => {
          throw err;
        });
        stream.pipe(destination);
      });
  }
}
